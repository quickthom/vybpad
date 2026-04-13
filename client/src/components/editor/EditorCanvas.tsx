import type { ChordEditAction, NoteEditAction, ScaleDegree, Selection, SongData, Viewport } from '@vybpad/shared';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { useKeyboard } from '../../hooks/useKeyboard';
import { theoryEngine } from '../../engine/theory';
import { CHORD_AREA_HEIGHT, MEASURE_HEADER_HEIGHT, NOTE_HEIGHT, SELECTION_COLOR } from '../../engine/renderer/constants';
import { drawChordBlocks, layoutChordBlock } from '../../engine/renderer/chordBlocks';
import { drawGridBackground } from '../../engine/renderer/gridBackground';
import type { EditorCanvasHit } from '../../engine/renderer/hitTest';
import { hitTestEditorCanvas } from '../../engine/renderer/hitTest';
import { absoluteTickToViewportX, getMeasureStartTicks, horizontalPxToTicks, horizontalTicksToPx } from '../../engine/renderer/layout';
import { drawGuideOverlay } from '../../engine/renderer/guideOverlay';
import { computeNoteBlockRect, drawNoteBlocks } from '../../engine/renderer/noteBlocks';
import { getMeterAtMeasure, measureLengthInTicks } from '../../engine/renderer/tickUtils';
import { chordStripCaretSelectionFromPointer } from './editorKeyboardLogic';
import {
  DRAG_THRESHOLD_PX,
  diatonicRowToDegreeAndOctave,
  nearestPitchGridFromStaffRelY,
  pointerEventToViewportXY,
  trailingResizeStripWidthPx,
  viewportYToStaffRelativeY,
} from './pointerMath';

/** INTERFACES.md — EditorCanvas props (shared types from `@vybpad/shared`). */
export interface EditorCanvasProps {
  song: SongData;
  viewport: Viewport;
  selection: Selection | null;
  playbackTick: number | null;
  activeVoice: 0 | 1 | 2 | 3;
  entryMode: 'table' | 'text';
  showGuides: boolean;
  colorScheme: 'diatonic' | 'major';
  onChordEdit: (measureIndex: number, event: ChordEditAction) => void;
  onNoteEdit: (measureIndex: number, voice: number, event: NoteEditAction) => void;
  onSelectionChange: (selection: Selection | null) => void;
  onViewportChange: (viewport: Viewport) => void;
  getSongAfterMutation?: () => SongData;
  getSelectionAfterMutation?: () => Selection | null;
  onToggleEntryMode?: () => void;
}

const SELECTION_STROKE = 'rgba(37, 99, 235, 0.8)';
const HOVER_STROKE = 'rgba(59, 130, 246, 0.7)';
const PLAYBACK_CURSOR_COLOR = '#EF4444';

const STAFF_DIATONIC_ROWS = 28;

type DragSession =
  | {
      phase: 'drag';
      kind: 'move' | 'resize';
      hit: EditorCanvasHit;
      pointerId: number;
      originClientX: number;
      originClientY: number;
      startBeat: number;
      startDuration: number;
      startScaleDegree?: ScaleDegree;
      startOctave?: number;
      startChromatic?: number;
    }
  | {
      phase: 'pending';
      hit: EditorCanvasHit | null;
      pointerId: number;
      originClientX: number;
      originClientY: number;
      /** When hit is null, we may clear selection on click. */
      isMiss: boolean;
      startBeat: number;
      startDuration: number;
      startScaleDegree?: ScaleDegree;
      startOctave?: number;
      startChromatic?: number;
    };

function visibleMeasuresWidthPx(song: SongData, viewport: Viewport): number {
  const starts = getMeasureStartTicks(song);
  const first = viewport.startMeasure;
  const lastEx = Math.min(first + viewport.measureCount, song.measures.length);
  return horizontalTicksToPx((starts[lastEx] ?? 0) - (starts[first] ?? 0), viewport.zoom);
}

function canvasHeightPx(): number {
  return MEASURE_HEADER_HEIGHT + CHORD_AREA_HEIGHT + STAFF_DIATONIC_ROWS * NOTE_HEIGHT;
}

function clampChordBeat(song: SongData, measureIndex: number, beat: number, duration: number): number {
  const len = measureLengthInTicks(getMeterAtMeasure(song, measureIndex));
  const maxStart = Math.max(0, len - duration);
  return Math.max(0, Math.min(Math.round(beat), maxStart));
}

function clampChordDuration(song: SongData, measureIndex: number, beat: number, duration: number): number {
  const len = measureLengthInTicks(getMeterAtMeasure(song, measureIndex));
  const d = Math.round(duration);
  return Math.max(1, Math.min(d, len - beat));
}

function findVoiceForNote(song: SongData, measureIndex: number, noteId: string): 0 | 1 | 2 | 3 | null {
  const m = song.measures[measureIndex];
  if (!m) return null;
  for (const v of [0, 1, 2, 3] as const) {
    if (m.notes[v].some((n) => n.id === noteId)) return v;
  }
  return null;
}

function selectionFromHit(hit: EditorCanvasHit): Selection {
  if (hit.kind === 'chord') {
    return { type: 'chord', measureIndex: hit.measureIndex, eventIds: [hit.chord.id] };
  }
  return { type: 'note', measureIndex: hit.measureIndex, eventIds: [hit.note.id] };
}

export function EditorCanvas(props: EditorCanvasProps): ReactElement {
  const {
    song,
    viewport,
    selection,
    playbackTick,
    colorScheme,
    showGuides,
    activeVoice,
    entryMode,
    onChordEdit,
    onNoteEdit,
    onSelectionChange,
    getSongAfterMutation,
    getSelectionAfterMutation,
    onToggleEntryMode,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const keyboardTargetMeasureRef = useRef<number | null>(null);
  const textDurationArmedRef = useRef(false);

  const [currentDurationTicks, setCurrentDurationTicks] = useState(48);

  const [hoverHit, setHoverHit] = useState<EditorCanvasHit | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [, forceRedraw] = useState(0);
  const rafRef = useRef<number | null>(null);

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      forceRedraw((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    textDurationArmedRef.current = false;
  }, [entryMode]);

  useKeyboard({
    song,
    viewport,
    selection,
    activeVoice,
    entryMode,
    currentDurationTicks,
    setCurrentDurationTicks,
    keyboardTargetMeasureRef,
    textDurationArmedRef,
    getSongAfterMutation,
    getSelectionAfterMutation,
    onToggleEntryMode,
    onChordEdit,
    onNoteEdit,
    onSelectionChange,
  });

  const hitIsResizeEdge = useCallback(
    (hit: EditorCanvasHit, vx: number): boolean => {
      if (hit.kind === 'chord') {
        const r = layoutChordBlock(hit.chord, hit.measureIndex, song, viewport);
        const right = r.x + r.width;
        const strip = trailingResizeStripWidthPx(r.width);
        return strip > 0 && vx >= right - strip && vx <= right;
      }
      const r = computeNoteBlockRect({
        song,
        viewport,
        measureIndex: hit.measureIndex,
        note: hit.note,
        isRest: hit.note.isRest,
      });
      const right = r.x + r.width;
      const strip = trailingResizeStripWidthPx(r.width);
      return strip > 0 && vx >= right - strip && vx <= right;
    },
    [song, viewport],
  );

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // Main canvas layer stack (bottom → top). Keep in sync with hitTest.ts global Z-order notes.
    // drawGridBackground → drawChordBlocks → drawNoteBlocks → drawGuideOverlay when showGuides.
    drawGridBackground(ctx, song, viewport, h);
    drawChordBlocks(ctx, song, viewport, theoryEngine, { colorScheme });
    drawNoteBlocks(ctx, song, viewport, { colorScheme });
    if (showGuides) {
      drawGuideOverlay(ctx, song, viewport, colorScheme);
    }

    const strokeRect = (x: number, y: number, rw: number, rh: number, stroke: string, fill?: string) => {
      ctx.save();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, rw, rh);
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, rw - 1, rh - 1);
      ctx.restore();
    };

    const drawHoverOrSelection = (hit: EditorCanvasHit, isSelection: boolean) => {
      if (hit.kind === 'chord') {
        const r = layoutChordBlock(hit.chord, hit.measureIndex, song, viewport);
        strokeRect(r.x, r.y, r.width, r.height, isSelection ? SELECTION_STROKE : HOVER_STROKE, isSelection ? SELECTION_COLOR : undefined);
      } else {
        const r = computeNoteBlockRect({
          song,
          viewport,
          measureIndex: hit.measureIndex,
          note: hit.note,
          isRest: hit.note.isRest,
        });
        strokeRect(r.x, r.y, r.width, r.height, isSelection ? SELECTION_STROKE : HOVER_STROKE, isSelection ? SELECTION_COLOR : undefined);
      }
    };

    if (hoverHit) {
      const selId = selection?.eventIds?.[0];
      const hid = hoverHit.kind === 'chord' ? hoverHit.chord.id : hoverHit.note.id;
      if (!selection || selId !== hid) {
        drawHoverOrSelection(hoverHit, false);
      }
    }

    if (selection?.eventIds?.length && selection.type !== 'range') {
      const id = selection.eventIds[0];
      const mi = selection.measureIndex;
      if (selection.type === 'chord') {
        const ch = song.measures[mi]?.chords.find((c) => c.id === id);
        if (ch) drawHoverOrSelection({ kind: 'chord', measureIndex: mi, chord: ch }, true);
      } else if (selection.type === 'note') {
        const voice = findVoiceForNote(song, mi, id);
        if (voice != null) {
          const note = song.measures[mi]?.notes[voice].find((n) => n.id === id);
          if (note) drawHoverOrSelection({ kind: 'note', measureIndex: mi, voiceIndex: voice, note }, true);
        }
      }
    }

    if (playbackTick != null) {
      const x = absoluteTickToViewportX(playbackTick, viewport, song);
      ctx.save();
      ctx.strokeStyle = PLAYBACK_CURSOR_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, h);
      ctx.stroke();
      ctx.restore();
    }
  }, [song, viewport, selection, hoverHit, playbackTick, colorScheme, showGuides]);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      const cssW = parent?.clientWidth ?? 800;
      const contentW = Math.max(visibleMeasuresWidthPx(song, viewport), cssW);
      const cssH = canvasHeightPx();
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${contentW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.floor(contentW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      scheduleRedraw();
    };

    resize();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      ro = new ResizeObserver(resize);
      ro.observe(canvas.parentElement);
    }
    window.addEventListener('resize', resize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [song, viewport, scheduleRedraw]);

  const endDrag = useCallback(
    (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
      const s = sessionRef.current;
      if (!s || s.phase !== 'drag') return;

      const origin = pointerEventToViewportXY(canvas, s.originClientX, s.originClientY);
      const end = pointerEventToViewportXY(canvas, clientX, clientY);
      const dvx = end.x - origin.x;
      const deltaTicks = horizontalPxToTicks(dvx, viewport.zoom);

      if (s.hit.kind === 'chord') {
        const ch = s.hit.chord;
        const mi = s.hit.measureIndex;
        if (s.kind === 'move') {
          const nb = clampChordBeat(song, mi, s.startBeat + deltaTicks, ch.duration);
          if (nb !== ch.beat) onChordEdit(mi, { type: 'move', chordId: ch.id, newBeat: nb });
        } else {
          const nd = clampChordDuration(song, mi, ch.beat, s.startDuration + deltaTicks);
          if (nd !== ch.duration) onChordEdit(mi, { type: 'resize', chordId: ch.id, newDuration: nd });
        }
      } else {
        const note = s.hit.note;
        const mi = s.hit.measureIndex;
        const voice = s.hit.voiceIndex;
        if (s.kind === 'move') {
          const nb = clampChordBeat(song, mi, s.startBeat + deltaTicks, note.duration);
          let newSd = note.scaleDegree;
          let newOct = note.octave;
          let newChr = note.chromatic;
          if (!note.isRest) {
            const vy = end.y;
            const rel = viewportYToStaffRelativeY(vy, viewport.scrollY);
            const grid = nearestPitchGridFromStaffRelY(rel);
            const po = diatonicRowToDegreeAndOctave(grid.diatonicRow);
            newSd = po.scaleDegree;
            newOct = po.octave;
            newChr = grid.chromatic;
          }
          const beatChanged = nb !== note.beat;
          const degreeOrOctChanged = !note.isRest && (newSd !== note.scaleDegree || newOct !== note.octave);
          const chromaticChanged = !note.isRest && newChr !== note.chromatic;
          if (beatChanged || degreeOrOctChanged) {
            onNoteEdit(mi, voice, {
              type: 'move',
              noteId: note.id,
              newBeat: nb,
              ...(newSd !== note.scaleDegree ? { newScaleDegree: newSd } : {}),
              ...(newOct !== note.octave ? { newOctave: newOct } : {}),
            });
          }
          if (chromaticChanged) {
            onNoteEdit(mi, voice, { type: 'update', noteId: note.id, changes: { chromatic: newChr } });
          }
        } else {
          const nd = clampChordDuration(song, mi, note.beat, s.startDuration + deltaTicks);
          if (nd !== note.duration) onNoteEdit(mi, voice, { type: 'resize', noteId: note.id, newDuration: nd });
        }
      }
      sessionRef.current = null;
    },
    [onChordEdit, onNoteEdit, song, viewport.scrollY, viewport.zoom],
  );

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    // Ensure the grid receives focus so window `keydown` handling (digits, durations) runs instead of
    // an accidental transport `<input>` focus skipping the handler (TASK-3.5 / TASK-4.2 E2E).
    canvas.focus({ preventScroll: true });
    const cx = e.clientX ?? 0;
    const cy = e.clientY ?? 0;
    const { x: vx, y: vy } = pointerEventToViewportXY(canvas, cx, cy);
    const hit = hitTestEditorCanvas(vx, vy, song, viewport);

    if (typeof canvas.setPointerCapture === 'function') {
      canvas.setPointerCapture(e.pointerId);
    }

    if (!hit) {
      keyboardTargetMeasureRef.current = null;
      // Empty chord strip: no chord rects yet, so hit-test misses — still establish a table caret
      // (collapsed range) so digit entry targets harmony (TASK-4.2 / persistence E2E).
      const chordStripCaret = chordStripCaretSelectionFromPointer(song, viewport, vx, vy);
      onSelectionChange(chordStripCaret);
      sessionRef.current = {
        phase: 'pending',
        hit: null,
        pointerId: e.pointerId,
        originClientX: cx,
        originClientY: cy,
        isMiss: true,
        startBeat: 0,
        startDuration: 0,
      };
      return;
    }

    keyboardTargetMeasureRef.current = null;
    onSelectionChange(selectionFromHit(hit));

    const onResizeEdge = hitIsResizeEdge(hit, vx);
    if (onResizeEdge) {
      sessionRef.current = {
        phase: 'drag',
        kind: 'resize',
        hit,
        pointerId: e.pointerId,
        originClientX: cx,
        originClientY: cy,
        startBeat: hit.kind === 'chord' ? hit.chord.beat : hit.note.beat,
        startDuration: hit.kind === 'chord' ? hit.chord.duration : hit.note.duration,
        ...(hit.kind === 'note'
          ? {
              startScaleDegree: hit.note.scaleDegree,
              startOctave: hit.note.octave,
              startChromatic: hit.note.chromatic,
            }
          : {}),
      };
      setIsDragging(true);
      return;
    }

    sessionRef.current = {
      phase: 'pending',
      hit,
      pointerId: e.pointerId,
      originClientX: cx,
      originClientY: cy,
      isMiss: false,
      startBeat: hit.kind === 'chord' ? hit.chord.beat : hit.note.beat,
      startDuration: hit.kind === 'chord' ? hit.chord.duration : hit.note.duration,
      ...(hit.kind === 'note'
        ? {
            startScaleDegree: hit.note.scaleDegree,
            startOctave: hit.note.octave,
            startChromatic: hit.note.chromatic,
          }
        : {}),
    };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const mcx = e.clientX ?? 0;
    const mcy = e.clientY ?? 0;
    const sess = sessionRef.current;

    if (!sess) {
      const { x: vx, y: vy } = pointerEventToViewportXY(canvas, mcx, mcy);
      const hit = hitTestEditorCanvas(vx, vy, song, viewport);
      setHoverHit(hit);
      scheduleRedraw();
      return;
    }

    if (sess.phase === 'drag') {
      return;
    }

    if (sess.phase === 'pending') {
      const dist = Math.hypot(mcx - sess.originClientX, mcy - sess.originClientY);
      if (dist >= DRAG_THRESHOLD_PX && sess.hit) {
        sessionRef.current = {
          phase: 'drag',
          kind: 'move',
          hit: sess.hit,
          pointerId: sess.pointerId,
          originClientX: sess.originClientX,
          originClientY: sess.originClientY,
          startBeat: sess.startBeat,
          startDuration: sess.startDuration,
          startScaleDegree: sess.startScaleDegree,
          startOctave: sess.startOctave,
          startChromatic: sess.startChromatic,
        };
        setIsDragging(true);
        setHoverHit(null);
      }
      return;
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;

    const ucx = e.clientX ?? 0;
    const ucy = e.clientY ?? 0;

    const sess = sessionRef.current;
    if (sess && e.pointerId === sess.pointerId) {
      if (typeof canvas.releasePointerCapture === 'function') {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      if (sess.phase === 'drag') {
        endDrag(canvas, ucx, ucy);
      }
      sessionRef.current = null;
      setIsDragging(false);
    }
    scheduleRedraw();
  };

  const cursorClass = isDragging ? 'cursor-grabbing' : hoverHit ? 'cursor-grab' : 'cursor-default';

  return (
    <canvas
      ref={canvasRef}
      role="application"
      tabIndex={0}
      className={`${cursorClass} outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2`}
      aria-label="Song editor — digits 1–7, duration h j k l ; , Delete, arrow keys to navigate"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
