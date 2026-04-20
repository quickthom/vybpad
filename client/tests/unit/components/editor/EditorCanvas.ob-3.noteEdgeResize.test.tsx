/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — OB-3
 *
 * Criterion: Resize melody notes by dragging note-block edges; updates must satisfy INTERFACES.md
 * `NoteEditAction` (`resize` with newDuration; `move` with newBeat when the start anchor changes).
 *
 * Trailing (right) edge — duration changes
 *   happy: pointer down in trailing resize strip + horizontal drag → `onNoteEdit` emits `resize` with
 *     clamped newDuration (> 0, within measure capacity).
 *   error / clamp: shrink so far that duration would fall below 1 tick → implementation clamps to ≥ 1.
 *   edges: extend toward measure end; shrink from initial duration.
 *
 * Leading (left) edge — start beat and duration change (end tick preserved)
 *   happy: pointer down in leading resize strip + drag → `onNoteEdit` emits `update` with
 *     `Partial<NoteEvent>` including `beat` and `duration` such that beat + duration matches the
 *     prior end offset (Hookpad-style), unless clamped (see `clampLeadingEdgeResizeTicks` in EditorCanvas).
 *   error: drag in the note body (not on an edge strip) must not be interpreted as edge-resize-only
 *     (covered by existing move tests; omitted here to avoid duplication).
 */

import { randomUUID } from 'node:crypto';

import type { NoteEvent, SongData, Viewport } from '@vybpad/shared';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorCanvas } from '../../../../src/components/editor/EditorCanvas';
import { softMagneticSnapMeasureTick, trailingResizeStripWidthPx } from '../../../../src/components/editor/pointerMath';
import { PITCH_GUTTER_WIDTH } from '../../../../src/engine/renderer/constants';
import { computeNoteBlockRect } from '../../../../src/engine/renderer/noteBlocks';
import { horizontalPxToTicks } from '../../../../src/engine/renderer/layout';
import { computeMelodyVoicePitchRanges } from '../../../../src/engine/renderer/layout';
import { getMeterAtMeasure, measureLengthInTicks } from '../../../../src/engine/renderer/tickUtils';
import { useSongStore } from '../../../../src/store/songStore';

const DEFAULT_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};

function makeSongWithMelodyNote(noteId: string, note: NoteEvent): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'T',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: randomUUID(),
        chords: [],
        notes: [[note], [], [], []],
      },
      ...Array.from({ length: 7 }, () => ({
        id: randomUUID(),
        chords: [],
        notes: [[], [], [], []] as [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]],
      })),
    ],
    bandConfig: {
      tracks: [
        { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
        { role: 'melody2', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
        { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
        { role: 'drums', instrument: 'piano', volume: 0.0, mute: true, octave: 0 },
      ],
    },
  };
}

function mockCanvasLayout(rect: Partial<DOMRect> & Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>) {
  const full: DOMRect = {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    left: rect.left,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON() {
      return {};
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(full);
}

function canvasIn(container: HTMLElement): HTMLCanvasElement {
  const el = container.querySelector('canvas');
  if (!el) {
    throw new Error('Editor canvas not found in container');
  }
  return el as HTMLCanvasElement;
}

/** Trailing-edge resize duration — matches EditorCanvas `clampChordDuration` + OB-5 magnetic snap. */
function expectedTrailingResizeNewDuration(
  song: SongData,
  measureIndex: number,
  beat: number,
  startDuration: number,
  deltaTicks: number,
): number {
  const len = measureLengthInTicks(getMeterAtMeasure(song, measureIndex));
  const d = Math.round(startDuration + deltaTicks);
  let endTick = beat + d;
  const minEnd = beat + 1;
  endTick = Math.max(minEnd, Math.min(endTick, len));
  const snappedEnd = softMagneticSnapMeasureTick(endTick, minEnd, len);
  const out = snappedEnd - beat;
  return Math.max(1, Math.min(out, len - beat));
}

function stubCanvas2d() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId) => {
    if (contextId !== '2d') {
      return null;
    }
    return {
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      clip: vi.fn(),
      translate: vi.fn(),
      setTransform: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      arcTo: vi.fn(),
      roundRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  });
}

/** Viewport X of the trailing resize strip center for hitIsResizeEdge (EditorCanvas). */
function trailingStripCenterVx(song: SongData, note: NoteEvent): number {
  const r = computeNoteBlockRect({
    song,
    viewport: DEFAULT_VIEWPORT,
    measureIndex: 0,
    note,
    isRest: note.isRest,
    voiceIndex: 0,
  });
  const right = r.x + r.width;
  const strip = trailingResizeStripWidthPx(r.width);
  return right - strip / 2;
}

/** Viewport X of the leading resize strip center — symmetric strip width (OB-3 contract). */
function leadingStripCenterVx(song: SongData, note: NoteEvent): number {
  const r = computeNoteBlockRect({
    song,
    viewport: DEFAULT_VIEWPORT,
    measureIndex: 0,
    note,
    isRest: note.isRest,
    voiceIndex: 0,
  });
  const strip = trailingResizeStripWidthPx(r.width);
  return r.x + strip / 2;
}

/** Vertical center of the note block in viewport coordinates (for hitTest). */
function noteMidClientY(song: SongData, note: NoteEvent, canvasTop: number): number {
  const [activeVoicePitchRange] = computeMelodyVoicePitchRanges(song);
  const r = computeNoteBlockRect({
    song,
    viewport: DEFAULT_VIEWPORT,
    measureIndex: 0,
    note,
    isRest: note.isRest,
    voiceIndex: 0,
    melodyVoicePitchRange: activeVoicePitchRange,
  });
  return canvasTop + r.y + r.height / 2;
}

describe('OB-3 — note edge resize (INTERFACES NoteEditAction via EditorCanvas)', () => {
  let noteId: string;
  let song: SongData;
  let note: NoteEvent;

  beforeEach(() => {
    noteId = randomUUID();
    note = {
      id: noteId,
      scaleDegree: 3,
      octave: 0,
      chromatic: 0,
      beat: 48,
      duration: 24,
      isRest: false,
      velocity: 100,
    };
    song = makeSongWithMelodyNote(noteId, note);
    useSongStore.getState().loadSong(structuredClone(song));
    vi.restoreAllMocks();
    stubCanvas2d();
  });

  afterEach(() => {
    cleanup();
  });

  describe('happy path — trailing (right) edge', () => {
    it('dispatches NoteEditAction resize with increased newDuration after dragging the trailing edge horizontally to the right', () => {
      const onNoteEdit = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'note', measureIndex: 0, eventIds: [noteId] }}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={onNoteEdit}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);
      const vxDown = trailingStripCenterVx(song, note);
      const midY = noteMidClientY(song, note, 0);
      const downX = PITCH_GUTTER_WIDTH + vxDown;
      const deltaPx = 80;
      const deltaTicks = horizontalPxToTicks(deltaPx, DEFAULT_VIEWPORT.zoom);

      fireEvent.pointerDown(canvas, {
        clientX: downX,
        clientY: midY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: downX + deltaPx,
        clientY: midY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: downX + deltaPx,
        clientY: midY,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const resizeCalls = onNoteEdit.mock.calls.filter(([, , ev]) => ev.type === 'resize');
      expect(resizeCalls.length).toBeGreaterThanOrEqual(1);
      const last = resizeCalls[resizeCalls.length - 1]![2];
      expect(last.type).toBe('resize');
      if (last.type === 'resize') {
        expect(last.noteId).toBe(noteId);
        expect(last.newDuration).toBe(
          expectedTrailingResizeNewDuration(song, 0, note.beat, note.duration, deltaTicks),
        );
        expect(last.newDuration).toBeLessThanOrEqual(192 - note.beat);
      }
    });

    it('dispatches NoteEditAction resize with decreased newDuration after dragging the trailing edge horizontally to the left', () => {
      const onNoteEdit = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'note', measureIndex: 0, eventIds: [noteId] }}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={onNoteEdit}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);
      const vxDown = trailingStripCenterVx(song, note);
      const midY = noteMidClientY(song, note, 0);
      const downX = PITCH_GUTTER_WIDTH + vxDown;
      const deltaPx = -8;
      const deltaTicks = horizontalPxToTicks(deltaPx, DEFAULT_VIEWPORT.zoom);

      fireEvent.pointerDown(canvas, {
        clientX: downX,
        clientY: midY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: downX + deltaPx,
        clientY: midY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: downX + deltaPx,
        clientY: midY,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const resizeCalls = onNoteEdit.mock.calls.filter(([, , ev]) => ev.type === 'resize');
      expect(resizeCalls.length).toBeGreaterThanOrEqual(1);
      const last = resizeCalls[resizeCalls.length - 1]![2];
      expect(last.type).toBe('resize');
      if (last.type === 'resize') {
        expect(last.noteId).toBe(noteId);
        expect(last.newDuration).toBe(
          expectedTrailingResizeNewDuration(song, 0, note.beat, note.duration, deltaTicks),
        );
        expect(last.newDuration).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('happy path — leading (left) edge', () => {
    it('dispatches NoteEditAction update with beat and duration so the note end tick is unchanged when dragging the leading edge to the right', () => {
      const onNoteEdit = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'note', measureIndex: 0, eventIds: [noteId] }}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={onNoteEdit}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);
      const vxDown = leadingStripCenterVx(song, note);
      const midY = noteMidClientY(song, note, 0);
      const downX = PITCH_GUTTER_WIDTH + vxDown;
      const deltaPx = 10;
      const deltaTicks = horizontalPxToTicks(deltaPx, DEFAULT_VIEWPORT.zoom);
      const endTick = note.beat + note.duration;
      let expectBeat = Math.round(note.beat + deltaTicks);
      expectBeat = Math.max(0, Math.min(expectBeat, endTick - 1));
      const expectDuration = Math.max(1, endTick - expectBeat);

      fireEvent.pointerDown(canvas, {
        clientX: downX,
        clientY: midY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: downX + deltaPx,
        clientY: midY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: downX + deltaPx,
        clientY: midY,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const updateCalls = onNoteEdit.mock.calls.filter(([, , ev]) => ev.type === 'update');
      expect(updateCalls.length).toBeGreaterThanOrEqual(1);
      const last = updateCalls[updateCalls.length - 1]![2];
      expect(last.type).toBe('update');
      if (last.type === 'update') {
        expect(last.noteId).toBe(noteId);
        expect(last.changes.beat).toBe(expectBeat);
        expect(last.changes.duration).toBe(expectDuration);
        expect((last.changes.beat ?? 0) + (last.changes.duration ?? 0)).toBe(endTick);
      }
    });
  });

  describe('edge cases', () => {
    it('clamps trailing-edge resize so newDuration is at least 1 tick when dragging far to the left', () => {
      const onNoteEdit = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'note', measureIndex: 0, eventIds: [noteId] }}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={onNoteEdit}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);
      const vxDown = trailingStripCenterVx(song, note);
      const midY = noteMidClientY(song, note, 0);
      const downX = PITCH_GUTTER_WIDTH + vxDown;

      fireEvent.pointerDown(canvas, {
        clientX: downX,
        clientY: midY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: downX - 500,
        clientY: midY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: downX - 500,
        clientY: midY,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const resizeCalls = onNoteEdit.mock.calls.filter(([, , ev]) => ev.type === 'resize');
      expect(resizeCalls.length).toBeGreaterThanOrEqual(1);
      const last = resizeCalls[resizeCalls.length - 1]![2];
      expect(last.type).toBe('resize');
      if (last.type === 'resize') {
        expect(last.newDuration).toBe(1);
      }
    });
  });

  describe('SongStore wiring', () => {
    it('updates measure 0 voice 0 note duration in the store after a trailing-edge resize drag when callbacks use editNote', () => {
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      function Harness() {
        const storeSong = useSongStore((s) => s.song);
        return (
          <EditorCanvas
            song={storeSong}
            viewport={DEFAULT_VIEWPORT}
            selection={{ type: 'note', measureIndex: 0, eventIds: [noteId] }}
            playbackTick={null}
            activeVoice={0}
            entryMode="table"
            showGuides={false}
            colorScheme="diatonic"
            onChordEdit={(mi, a) => {
              useSongStore.getState().editChord(mi, a);
            }}
            onNoteEdit={(mi, v, a) => {
              useSongStore.getState().editNote(mi, v, a);
            }}
            onSelectionChange={vi.fn()}
            onViewportChange={vi.fn()}
          />
        );
      }

      const { container } = render(<Harness />);
      const canvas = canvasIn(container);

      const n = useSongStore.getState().song.measures[0]!.notes[0]![0]!;
      const vxDown = trailingStripCenterVx(song, n);
      const midY = noteMidClientY(song, n, 0);
      const downX = PITCH_GUTTER_WIDTH + vxDown;
      const deltaPx = 80;
      const deltaTicks = horizontalPxToTicks(deltaPx, DEFAULT_VIEWPORT.zoom);

      fireEvent.pointerDown(canvas, {
        clientX: downX,
        clientY: midY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: downX + deltaPx,
        clientY: midY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: downX + deltaPx,
        clientY: midY,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const edited = useSongStore.getState().song.measures[0]!.notes[0]!.find((x) => x.id === noteId);
      expect(edited).toBeDefined();
      expect(edited!.duration).toBe(n.duration + deltaTicks);
    });
  });
});
