import type {
  ChordEditAction,
  ChordEvent,
  NoteEditAction,
  NoteEvent,
  ScaleDegree,
  Selection,
  SongData,
  Viewport,
} from '@vybpad/shared';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactElement,
  type SetStateAction,
} from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import type { ShortcutContext, ShortcutManager } from '../../engine/keyboard/shortcutTypes';
import { playEditorHitAudition } from '../../engine/audio/auditionPreview';
import type { EditorCanvasHit } from '../../engine/renderer/hitTest';
import { useKeyboard } from '../../hooks/useKeyboard';
import { usePlaybackStore } from '../../store/playbackStore';
import type { EditorLabelMode, StaffSpacing } from '../../types/editorChrome';
import { useUIStore } from '../../store/uiStore';
import { melodyRowHeightPx } from '../../utils/staffSpacing';
import { theoryEngine } from '../../engine/theory';
import {
  CHORD_AREA_HEIGHT,
  MEASURE_HEADER_HEIGHT,
  MELODY_DIATONIC_ROW_COUNT,
  PITCH_GUTTER_WIDTH,
  SELECTION_COLOR,
} from '../../engine/renderer/constants';
import { drawPlaybackCursor } from '../../engine/renderer/drawPlaybackCursor';
import { drawPlaybackHighlight } from '../../engine/renderer/drawPlaybackHighlight';
import { drawChordBlocks, layoutChordBlock } from '../../engine/renderer/chordBlocks';
import { drawGridBackground } from '../../engine/renderer/gridBackground';
import { hitTestEditorCanvas } from '../../engine/renderer/hitTest';
import { getMeasureStartTicks, horizontalPxToTicks, horizontalTicksToPx } from '../../engine/renderer/layout';
import { computePitchAxisLabelsInViewport, drawPitchAxisGutter } from '../../engine/renderer/pitchAxisLayout';
import { drawGuideOverlay } from '../../engine/renderer/guideOverlay';
import { computeNoteBlockRect, drawNoteBlocks } from '../../engine/renderer/noteBlocks';
import { getMeterAtMeasure, measureLengthInTicks } from '../../engine/renderer/tickUtils';
import { chordStripCaretSelectionFromPointer } from './editorKeyboardLogic';
import {
  classifyHorizontalResizeEdge,
  DRAG_THRESHOLD_PX,
  diatonicRowToDegreeAndOctave,
  nearestPitchGridFromStaffRelY,
  pointerEventToViewportXY,
  softMagneticSnapMeasureTick,
  viewportYToStaffRelativeY,
} from './pointerMath';

/** Shared keyboard state for `EditorCanvas` + shell chord palette (TASK-5.1). */
export interface EditorKeyboardPlumbing {
  keyboardTargetMeasureRef: MutableRefObject<number | null>;
  textDurationArmedRef: MutableRefObject<boolean>;
  currentDurationTicks: number;
  setCurrentDurationTicks: Dispatch<SetStateAction<number>>;
}

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
  /** Defaults match `UIStore` / INTERFACES.md when omitted (tests). */
  labelMode?: EditorLabelMode;
  staffSpacing?: StaffSpacing;
  onChordEdit: (measureIndex: number, event: ChordEditAction) => void;
  onNoteEdit: (measureIndex: number, voice: number, event: NoteEditAction) => void;
  /** TASK-7.3 — batched note edits for split/tie (single undo); optional. */
  onNoteEditBatch?: (
    operations: ReadonlyArray<{ measureIndex: number; voice: 0 | 1 | 2 | 3; action: NoteEditAction }>,
  ) => void;
  onSelectionChange: (selection: Selection | null) => void;
  onViewportChange: (viewport: Viewport) => void;
  getSongAfterMutation?: () => SongData;
  getSelectionAfterMutation?: () => Selection | null;
  onToggleEntryMode?: () => void;
  /** When set, chord palette + canvas share duration + cross-measure digit targeting refs. */
  keyboardPlumbing?: EditorKeyboardPlumbing;
  /** PAT-027 — shell supplies manager + live context (modal/focus gating). */
  shortcutManager?: ShortcutManager | null;
  getShortcutContext?: () => ShortcutContext;
  /** UI-W3 — left-panel Chromatic toggle; new melody notes use default `chromatic` per PAT-018 when true. */
  melodyChromaticEntryActive?: boolean;
  /** UI-W4 — see INTERFACES.md `EditorCanvasProps`; omitted → all voices visible, alpha inactive lanes. */
  melodyVoiceVisible?: readonly [boolean, boolean, boolean, boolean];
  inactiveMelodyDisplayMode?: 'outline' | 'solid' | 'alpha';
  smartOctaveEnabled?: boolean;
}

const SELECTION_STROKE = 'rgba(37, 99, 235, 0.8)';
const HOVER_STROKE = 'rgba(59, 130, 246, 0.7)';

type DragSession =
  | {
      phase: 'drag';
      kind: 'move' | 'resize';
      /** Start vs end edge for `resize` (melody/chord blocks). */
      resizeEdge?: 'leading' | 'trailing';
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

function canvasHeightPx(melodyRowHeight: number): number {
  return MEASURE_HEADER_HEIGHT + MELODY_DIATONIC_ROW_COUNT * melodyRowHeight + CHORD_AREA_HEIGHT;
}

/** Move: clamp start beat; OB-5 soft-snaps to PAT-004 sixteenth grid before clamping. */
function clampChordBeat(song: SongData, measureIndex: number, beat: number, duration: number): number {
  const len = measureLengthInTicks(getMeterAtMeasure(song, measureIndex));
  const maxStart = Math.max(0, len - duration);
  const b = softMagneticSnapMeasureTick(Math.round(beat), 0, maxStart);
  return Math.max(0, Math.min(b, maxStart));
}

/** Trailing resize: snap trailing edge tick, then derive duration (OB-5). */
function clampChordDuration(song: SongData, measureIndex: number, beat: number, duration: number): number {
  const len = measureLengthInTicks(getMeterAtMeasure(song, measureIndex));
  const d = Math.round(duration);
  let endTick = beat + d;
  const minEnd = beat + 1;
  endTick = Math.max(minEnd, Math.min(endTick, len));
  const snappedEnd = softMagneticSnapMeasureTick(endTick, minEnd, len);
  const out = snappedEnd - beat;
  return Math.max(1, Math.min(out, len - beat));
}

/** Leading-edge resize keeps the note/chord end tick fixed (Hookpad-style); OB-5 snaps leading edge. */
function clampLeadingEdgeResizeTicks(
  startBeat: number,
  startDuration: number,
  deltaTicks: number,
): { beat: number; duration: number } {
  const endRel = startBeat + startDuration;
  let nb = Math.round(startBeat + deltaTicks);
  nb = Math.max(0, Math.min(nb, endRel - 1));
  nb = softMagneticSnapMeasureTick(nb, 0, endRel - 1);
  const nd = Math.max(1, endRel - nb);
  return { beat: nb, duration: nd };
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

/** RTL/jsdom sometimes omits `pointerId` on synthesized `pointerup`; single-session canvas treats that as the same gesture. */
function pointerIdMatchesSession(sess: DragSession, e: ReactPointerEvent<HTMLCanvasElement>): boolean {
  return e.pointerId === sess.pointerId || typeof e.pointerId !== 'number';
}

export function EditorCanvas(props: EditorCanvasProps): ReactElement {
  const {
    song,
    viewport,
    selection,
    playbackTick,
    colorScheme,
    showGuides,
    labelMode = 'degree',
    staffSpacing = 'default',
    activeVoice,
    entryMode,
    onChordEdit,
    onNoteEdit,
    onNoteEditBatch,
    onSelectionChange,
    getSongAfterMutation,
    getSelectionAfterMutation,
    onToggleEntryMode,
    keyboardPlumbing,
    shortcutManager,
    getShortcutContext,
    melodyChromaticEntryActive = false,
    melodyVoiceVisible = [true, true, true, true] as const,
    inactiveMelodyDisplayMode = 'alpha',
    smartOctaveEnabled = false,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const internalKeyboardTargetMeasureRef = useRef<number | null>(null);
  const internalTextDurationArmedRef = useRef(false);
  const [internalDurationTicks, setInternalDurationTicks] = useState(48);

  const keyboardTargetMeasureRef = keyboardPlumbing?.keyboardTargetMeasureRef ?? internalKeyboardTargetMeasureRef;
  const textDurationArmedRef = keyboardPlumbing?.textDurationArmedRef ?? internalTextDurationArmedRef;
  const currentDurationTicks = keyboardPlumbing?.currentDurationTicks ?? internalDurationTicks;
  const setCurrentDurationTicks = keyboardPlumbing?.setCurrentDurationTicks ?? setInternalDurationTicks;

  const setActiveVoice = useUIStore((s) => s.setActiveVoice);

  const melodyRowHeight = useMemo(() => melodyRowHeightPx(staffSpacing), [staffSpacing]);

  const [hoverHit, setHoverHit] = useState<EditorCanvasHit | null>(null);
  /** `resize` uses ew-resize; `move` uses grabbing (OB-3). */
  const [activeDragKind, setActiveDragKind] = useState<'idle' | 'move' | 'resize'>('idle');
  const [hoverOnResizeEdge, setHoverOnResizeEdge] = useState(false);
  const rafRef = useRef<number | null>(null);
  /** Live resize outline during trailing/leading drag (pointer-up commits to store). */
  const dragResizePreviewRef = useRef<{ hit: EditorCanvasHit; beat: number; duration: number } | null>(null);
  /** Latest paint closure — resize + rAF paths must repaint without relying on stale React state (PAT-008, OB-4). */
  const paintRef = useRef<() => void>(() => {});

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      paintRef.current();
    });
  }, []);

  useEffect(() => {
    textDurationArmedRef.current = false;
  }, [entryMode]);

  // After route load the focused element may still be a toolbar `<input>` (e.g. tempo). Grid digit
  // entry is suppressed while `document.activeElement` is editable — focus the canvas once mounted
  // so `handleEditorKeydown` receives 1–7 unless the user deliberately focuses another control (TASK-4.2).
  useEffect(() => {
    canvasRef.current?.focus({ preventScroll: true });
  }, []);

  useKeyboard({
    song,
    viewport,
    selection,
    activeVoice,
    setActiveVoice,
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
    editNoteBatch: onNoteEditBatch,
    onSelectionChange,
    shortcutManager,
    getShortcutContext,
    melodyChromaticEntryActive,
    smartOctaveEnabled,
  });

  const hitResizeEdge = useCallback(
    (hit: EditorCanvasHit, vx: number): 'leading' | 'trailing' | null => {
      if (hit.kind === 'chord') {
        const r = layoutChordBlock(hit.chord, hit.measureIndex, song, viewport, melodyRowHeight);
        return classifyHorizontalResizeEdge(r.x, r.width, vx);
      }
      const r = computeNoteBlockRect({
        song,
        viewport,
        measureIndex: hit.measureIndex,
        note: hit.note,
        isRest: hit.note.isRest,
        voiceIndex: hit.voiceIndex,
        melodyRowHeight,
      });
      return classifyHorizontalResizeEdge(r.x, r.width, vx);
    },
    [song, viewport, melodyRowHeight],
  );

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // `willReadFrequently` keeps readbacks (E2E probes, devtools) reliable after GPU tiling — not a perf hot path vs song edits.
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const gridContentW = Math.max(0, w - PITCH_GUTTER_WIDTH);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    const pitchLabels = computePitchAxisLabelsInViewport(song, viewport, h, melodyRowHeight);

    // Main canvas layer stack (bottom → top). Keep in sync with hitTest.ts global Z-order notes.
    // Grid + blocks are translated past the pitch gutter; gutter labels paint afterward on the left strip.
    ctx.save();
    ctx.translate(PITCH_GUTTER_WIDTH, 0);
    // drawGridBackground → drawNoteBlocks → drawChordBlocks (RA-2 bottom strip) → drawGuideOverlay → drawPlaybackHighlight → hover/selection → cursor.
    drawGridBackground(ctx, song, viewport, h, {
      melodyRowHeight,
      gridContentWidthPx: gridContentW,
    });
    drawNoteBlocks(ctx, song, viewport, {
      colorScheme,
      labelMode,
      melodyRowHeight,
      melodyVoiceVisible,
      activeVoice,
      inactiveMelodyDisplayMode,
    });
    drawChordBlocks(ctx, song, viewport, theoryEngine, { colorScheme, labelMode, melodyRowHeight });
    if (showGuides) {
      drawGuideOverlay(ctx, song, viewport, colorScheme, { melodyRowHeight });
    }

    drawPlaybackHighlight(ctx, song, viewport, playbackTick, melodyRowHeight, melodyVoiceVisible);

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
        const r = layoutChordBlock(hit.chord, hit.measureIndex, song, viewport, melodyRowHeight);
        strokeRect(r.x, r.y, r.width, r.height, isSelection ? SELECTION_STROKE : HOVER_STROKE, isSelection ? SELECTION_COLOR : undefined);
      } else {
        const r = computeNoteBlockRect({
          song,
          viewport,
          measureIndex: hit.measureIndex,
          note: hit.note,
          isRest: hit.note.isRest,
          voiceIndex: hit.voiceIndex,
          melodyRowHeight,
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

    const rp = dragResizePreviewRef.current;
    if (rp) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.85)';
      ctx.lineWidth = 1;
      if (rp.hit.kind === 'chord') {
        const ch: ChordEvent = { ...rp.hit.chord, beat: rp.beat, duration: rp.duration };
        const r = layoutChordBlock(ch, rp.hit.measureIndex, song, viewport, melodyRowHeight);
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.width - 1, r.height - 1);
      } else {
        const n: NoteEvent = { ...rp.hit.note, beat: rp.beat, duration: rp.duration };
        const r = computeNoteBlockRect({
          song,
          viewport,
          measureIndex: rp.hit.measureIndex,
          note: n,
          isRest: rp.hit.note.isRest,
          voiceIndex: rp.hit.voiceIndex,
          melodyRowHeight,
        });
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.width - 1, r.height - 1);
      }
      ctx.restore();
    }

    drawPlaybackCursor(ctx, song, viewport, playbackTick, h);
    ctx.restore();

    drawPitchAxisGutter(ctx, pitchLabels, PITCH_GUTTER_WIDTH);
  }, [
    song,
    viewport,
    selection,
    hoverHit,
    playbackTick,
    colorScheme,
    showGuides,
    labelMode,
    melodyRowHeight,
    activeVoice,
    melodyVoiceVisible,
    inactiveMelodyDisplayMode,
  ]);

  paintRef.current = paint;

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      const cssW = parent?.clientWidth ?? 800;
      const contentW = PITCH_GUTTER_WIDTH + Math.max(visibleMeasuresWidthPx(song, viewport), cssW);
      const cssH = canvasHeightPx(melodyRowHeight);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${contentW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.floor(contentW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      // Setting width/height clears the bitmap; repaint immediately so we never flash blank (OB-4).
      paintRef.current();
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
  }, [song, viewport, melodyRowHeight]);

  const endDrag = useCallback(
    (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
      const s = sessionRef.current;
      if (!s || s.phase !== 'drag') return;

      const origin = pointerEventToViewportXY(canvas, s.originClientX, s.originClientY, PITCH_GUTTER_WIDTH);
      const end = pointerEventToViewportXY(canvas, clientX, clientY, PITCH_GUTTER_WIDTH);
      const dvx = end.x - origin.x;
      const deltaTicks = horizontalPxToTicks(dvx, viewport.zoom);

      if (s.hit.kind === 'chord') {
        const ch = s.hit.chord;
        const mi = s.hit.measureIndex;
        if (s.kind === 'move') {
          const nb = clampChordBeat(song, mi, s.startBeat + deltaTicks, ch.duration);
          if (nb !== ch.beat) onChordEdit(mi, { type: 'move', chordId: ch.id, newBeat: nb });
        } else {
          const edge = s.resizeEdge ?? 'trailing';
          if (edge === 'trailing') {
            const nd = clampChordDuration(song, mi, ch.beat, s.startDuration + deltaTicks);
            if (nd !== ch.duration) onChordEdit(mi, { type: 'resize', chordId: ch.id, newDuration: nd });
          } else {
            const { beat: nb, duration: nd } = clampLeadingEdgeResizeTicks(s.startBeat, s.startDuration, deltaTicks);
            if (nb !== ch.beat || nd !== ch.duration) {
              onChordEdit(mi, {
                type: 'update',
                chordId: ch.id,
                changes: { beat: nb, duration: nd },
              });
            }
          }
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
            const grid = nearestPitchGridFromStaffRelY(rel, melodyRowHeight);
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
          const edge = s.resizeEdge ?? 'trailing';
          if (edge === 'trailing') {
            const nd = clampChordDuration(song, mi, note.beat, s.startDuration + deltaTicks);
            if (nd !== note.duration) onNoteEdit(mi, voice, { type: 'resize', noteId: note.id, newDuration: nd });
          } else {
            const { beat: nb, duration: nd } = clampLeadingEdgeResizeTicks(s.startBeat, s.startDuration, deltaTicks);
            if (nb !== note.beat || nd !== note.duration) {
              onNoteEdit(mi, voice, {
                type: 'update',
                noteId: note.id,
                changes: { beat: nb, duration: nd },
              });
            }
          }
        }
      }
      sessionRef.current = null;
    },
    [onChordEdit, onNoteEdit, song, viewport.scrollY, viewport.zoom, melodyRowHeight],
  );

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    // Ensure the grid receives focus so window `keydown` handling (digits, durations) runs instead of
    // an accidental transport `<input>` focus skipping the handler (TASK-3.5 / TASK-4.2 E2E).
    canvas.focus({ preventScroll: true });
    const cx = e.clientX ?? 0;
    const cy = e.clientY ?? 0;
    const { x: vx, y: vy } = pointerEventToViewportXY(canvas, cx, cy, PITCH_GUTTER_WIDTH);
    const hit = hitTestEditorCanvas(vx, vy, song, viewport, melodyRowHeight, melodyVoiceVisible);

    if (typeof canvas.setPointerCapture === 'function') {
      canvas.setPointerCapture(e.pointerId);
    }

    if (!hit) {
      keyboardTargetMeasureRef.current = null;
      // Empty chord strip: no chord rects yet, so hit-test misses — still establish a table caret
      // (collapsed range) so digit entry targets harmony (TASK-4.2 / persistence E2E).
      const chordStripCaret = chordStripCaretSelectionFromPointer(song, viewport, vx, vy, melodyRowHeight);
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

    const resizeEdge = hitResizeEdge(hit, vx);
    if (resizeEdge != null) {
      sessionRef.current = {
        phase: 'drag',
        kind: 'resize',
        resizeEdge,
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
      setActiveDragKind('resize');
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
      const { x: vx, y: vy } = pointerEventToViewportXY(canvas, mcx, mcy, PITCH_GUTTER_WIDTH);
      const hit = hitTestEditorCanvas(vx, vy, song, viewport, melodyRowHeight, melodyVoiceVisible);
      setHoverHit(hit);
      setHoverOnResizeEdge(hit != null && hitResizeEdge(hit, vx) != null);
      scheduleRedraw();
      return;
    }

    if (sess.phase === 'drag' && sess.kind === 'resize') {
      const origin = pointerEventToViewportXY(canvas, sess.originClientX, sess.originClientY, PITCH_GUTTER_WIDTH);
      const end = pointerEventToViewportXY(canvas, mcx, mcy, PITCH_GUTTER_WIDTH);
      const deltaTicks = horizontalPxToTicks(end.x - origin.x, viewport.zoom);
      const edge = sess.resizeEdge ?? 'trailing';
      if (sess.hit.kind === 'chord') {
        const ch = sess.hit.chord;
        const mi = sess.hit.measureIndex;
        let beat = ch.beat;
        let duration = ch.duration;
        if (edge === 'trailing') {
          duration = clampChordDuration(song, mi, ch.beat, sess.startDuration + deltaTicks);
        } else {
          const o = clampLeadingEdgeResizeTicks(sess.startBeat, sess.startDuration, deltaTicks);
          beat = o.beat;
          duration = o.duration;
        }
        dragResizePreviewRef.current = { hit: sess.hit, beat, duration };
      } else {
        const note = sess.hit.note;
        const mi = sess.hit.measureIndex;
        let beat = note.beat;
        let duration = note.duration;
        if (edge === 'trailing') {
          duration = clampChordDuration(song, mi, note.beat, sess.startDuration + deltaTicks);
        } else {
          const o = clampLeadingEdgeResizeTicks(sess.startBeat, sess.startDuration, deltaTicks);
          beat = o.beat;
          duration = o.duration;
        }
        dragResizePreviewRef.current = { hit: sess.hit, beat, duration };
      }
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
        setActiveDragKind('move');
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
    let auditionHit: EditorCanvasHit | null = null;
    if (
      sess &&
      pointerIdMatchesSession(sess, e) &&
      sess.phase === 'pending' &&
      sess.hit &&
      !sess.isMiss
    ) {
      auditionHit = sess.hit;
    }

    if (sess && pointerIdMatchesSession(sess, e)) {
      if (typeof canvas.releasePointerCapture === 'function') {
        try {
          const releaseId = typeof e.pointerId === 'number' ? e.pointerId : sess.pointerId;
          canvas.releasePointerCapture(releaseId);
        } catch {
          /* ignore */
        }
      }

      if (sess.phase === 'drag') {
        endDrag(canvas, ucx, ucy);
      }
      sessionRef.current = null;
      dragResizePreviewRef.current = null;
      setActiveDragKind('idle');
    }

    if (auditionHit) {
      const songSnap = song;
      const hit = auditionHit;
      void usePlaybackStore
        .getState()
        .initializeAudio()
        .then(() => {
          if (usePlaybackStore.getState().initStatus !== 'ready') {
            return;
          }
          playEditorHitAudition(songSnap, hit);
        })
        .catch(() => {
          /* Init failure is surfaced via transport; audition is best-effort. */
        });
    }

    scheduleRedraw();
  };

  /** Real-browser drag affordance (Phase 2 archive: not “dead” in jsdom — hover hit-testing is limited in tests, but classes are live in Chromium/WebKit). */
  const cursorClass =
    activeDragKind === 'resize' || hoverOnResizeEdge
      ? 'cursor-ew-resize'
      : activeDragKind === 'move'
        ? 'cursor-grabbing'
        : hoverHit
          ? 'cursor-grab'
          : 'cursor-default';

  // TODO(Designer): optional side-rail caption for chord shortcuts (F08.2); aria-label covers screen readers until then.

  const visBits = melodyVoiceVisible.map((v) => (v ? '1' : '0')).join('');

  return (
    <canvas
      ref={canvasRef}
      role="application"
      tabIndex={0}
      data-melody-inactive-display-mode={inactiveMelodyDisplayMode}
      data-melody-voice-visible={visBits}
      data-smart-octave={smartOctaveEnabled ? 'true' : 'false'}
      className={`${cursorClass} outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2`}
      aria-label="Song editor — digits 1–7; chord d secondary, i inversion, e embellishment; duration h j k l ; ` ' (triplet row q w e r t); Delete, arrow keys to navigate, Ctrl+1–4 melody voice"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
