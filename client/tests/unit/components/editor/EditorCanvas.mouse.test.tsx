/** @vitest-environment jsdom */
/**
 * QA COVERAGE PLAN — TASK-2.7
 *
 * Criterion 1: Hit test uses exported hitTestEditorCanvas (renderer barrel / hitTest module) with (x,y) in layout/renderer viewport space
 *   happy: pointer interaction results in hitTestEditorCanvas called with transformed coords matching clientX/Y − canvas bounds
 *   error: (not specified) — omit
 *   edges: —
 *
 * Criterion 2: Primary click on chord/note hit → onSelectionChange(Selection); miss → onSelectionChange(null)
 *   happy: chord hit → type "chord", measureIndex, eventIds contains hit id; note hit → type "note", same
 *   error: miss → null (or documented alternative — test asserts null)
 *   edges: —
 *
 * Criterion 3: Drag move maps horizontal delta to ticks/beats; dispatches ChordEditAction move or NoteEditAction move with valid newBeat; vertical note move uses newScaleDegree/newOctave per INTERFACES
 *   happy: move actions with expected shape after pointer drag
 *   error: drag without prior selection does not dispatch move (or documented behavior)
 *   edges: newBeat within measure (PAT-004)
 *
 * Criterion 4: Horizontal resize → resize actions with newDuration; clamp to measure, positive duration
 *   happy: onChordEdit/onNoteEdit resize with clamped newDuration
 *   edges: duration ≥ 1 tick
 *
 * Criterion 5: onChordEdit/onNoteEdit wired to SongStore.editChord/editNote; song updates in store after interaction
 *   happy: harness wires store; after edit, useSongStore.getState().song reflects mutation
 *
 * Criterion 6: viewport/selection state matches INTERFACES Viewport and Selection | null via props/callbacks
 *   happy: onViewportChange/onSelectionChange invoked with contract shapes when applicable
 *   edges: —
 *
 * Criterion 7: npm test passes once implementation exists — enforced by CI; this file is the failing baseline until then.
 */

import { randomUUID } from 'node:crypto';

import type { ChordEvent, NoteEvent, SongData, Viewport } from '@vybpad/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorCanvas } from '../../../../src/components/editor/EditorCanvas';
import * as hitTestModule from '../../../../src/engine/renderer/hitTest';
import { horizontalTicksToPx } from '../../../../src/engine/renderer/layout';
import { MEASURE_HEADER_HEIGHT, NOTE_HEIGHT, PITCH_GUTTER_WIDTH } from '../../../../src/engine/renderer/constants';
import { useSongStore } from '../../../../src/store/songStore';

const DEFAULT_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};

function makeSongWithChordAndNote(chordId: string, noteId: string, noteOverrides?: Partial<NoteEvent>): SongData {
  const chord: ChordEvent = {
    id: chordId,
    scaleDegree: 1,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat: 0,
    duration: 96,
  };
  const note: NoteEvent = {
    id: noteId,
    scaleDegree: 3,
    octave: 0,
    chromatic: 0,
    beat: 48,
    duration: 24,
    isRest: false,
    velocity: 100,
    ...noteOverrides,
  };
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
        chords: [chord],
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
  // Spy on the prototype so remounted canvases (React StrictMode) still see the same layout rect.
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(full);
}

/** Scope to the RTL container so mocks apply to the same canvas node that receives pointer events. */
function canvasIn(container: HTMLElement): HTMLCanvasElement {
  const el = container.querySelector('canvas');
  if (!el) {
    throw new Error('Editor canvas not found in container');
  }
  return el as HTMLCanvasElement;
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

describe('EditorCanvas — TASK-2.7 mouse interaction (interface contract)', () => {
  let song: SongData;
  let chordId: string;
  let noteId: string;

  beforeEach(() => {
    chordId = randomUUID();
    noteId = randomUUID();
    song = makeSongWithChordAndNote(chordId, noteId);
    useSongStore.getState().loadSong(structuredClone(song));
    vi.restoreAllMocks();
    stubCanvas2d();
  });

  afterEach(() => {
    cleanup();
  });

  describe('hit testing (hitTestEditorCanvas)', () => {
    it('invokes hitTestEditorCanvas with viewport (x,y) equal to client coordinates minus canvas getBoundingClientRect offset', () => {
      const onSelectionChange = vi.fn();
      const hitSpy = vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue(null);

      mockCanvasLayout({ left: 120, top: 40, width: 900, height: 500 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={onSelectionChange}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);

      fireEvent.pointerDown(canvas, {
        clientX: 220,
        clientY: 90,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });

      expect(hitSpy).toHaveBeenCalled();
      /* Viewport x/y subtract canvas rect and the pitch gutter (40px) so grid space starts at 0. */
      const downCall = hitSpy.mock.calls.find(([x, y]) => x === 60 && y === 50);
      expect(downCall).toBeDefined();
      const [, , argSong, argViewport] = downCall!;
      expect(argSong).toBe(song);
      expect(argViewport).toEqual(DEFAULT_VIEWPORT);
    });
  });

  describe('click → selection', () => {
    it('calls onSelectionChange with type "chord", measureIndex, and eventIds containing the hit chord id on primary pointer down over a chord hit', () => {
      const onSelectionChange = vi.fn();
      const chord = song.measures[0]!.chords[0]!;

      vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
        kind: 'chord',
        measureIndex: 0,
        chord,
      });

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={onSelectionChange}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);
      fireEvent.pointerDown(canvas, {
        clientX: 10,
        clientY: 30,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });

      expect(onSelectionChange).toHaveBeenCalledWith({
        type: 'chord',
        measureIndex: 0,
        eventIds: [chordId],
      });
    });

    it('calls onSelectionChange with type "note", measureIndex, and eventIds containing the hit note id on primary pointer down over a note hit', () => {
      const onSelectionChange = vi.fn();
      const note = song.measures[0]!.notes[0]![0]!;

      vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
        kind: 'note',
        measureIndex: 0,
        voiceIndex: 0,
        note,
      });

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={onSelectionChange}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);
      fireEvent.pointerDown(canvas, {
        clientX: 50,
        clientY: 200,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });

      expect(onSelectionChange).toHaveBeenCalledWith({
        type: 'note',
        measureIndex: 0,
        eventIds: [noteId],
      });
    });

    it('establishes a collapsed range caret on empty melody-grid click (viewport x maps to beat)', () => {
      const onSelectionChange = vi.fn();
      vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue(null);

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={onSelectionChange}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);
      const targetBeat = 96;
      const targetX = PITCH_GUTTER_WIDTH + horizontalTicksToPx(targetBeat, DEFAULT_VIEWPORT.zoom);
      const targetY = MEASURE_HEADER_HEIGHT + NOTE_HEIGHT;
      fireEvent.pointerDown(canvas, {
        clientX: targetX,
        clientY: targetY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });

      expect(onSelectionChange).toHaveBeenCalledWith({
        type: 'range',
        measureIndex: 0,
        rangeStart: targetBeat,
        rangeEnd: targetBeat,
      });
    });
  });

  describe('drag move', () => {
    it('dispatches ChordEditAction move with integer newBeat within the measure when dragging horizontally after a chord selection', () => {
      const onChordEdit = vi.fn();
      vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
        kind: 'chord',
        measureIndex: 0,
        chord: song.measures[0]!.chords[0]!,
      });

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'chord', measureIndex: 0, eventIds: [chordId] }}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={onChordEdit}
          onNoteEdit={vi.fn()}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);

      fireEvent.pointerDown(canvas, {
        clientX: 100,
        clientY: 40,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: 180,
        clientY: 40,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: 180,
        clientY: 40,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      expect(onChordEdit).toHaveBeenCalled();
      const moveCalls = onChordEdit.mock.calls.filter(
        ([, ev]) => ev.type === 'move',
      );
      expect(moveCalls.length).toBeGreaterThanOrEqual(1);
      const lastMove = moveCalls[moveCalls.length - 1]![1];
      expect(lastMove).toMatchObject({
        type: 'move',
        chordId,
      });
      expect(lastMove.type === 'move' && Number.isInteger(lastMove.newBeat)).toBe(true);
      expect(lastMove.type === 'move' && lastMove.newBeat).toBeGreaterThanOrEqual(0);
      expect(lastMove.type === 'move' && lastMove.newBeat).toBeLessThanOrEqual(192);
    });

    it('dispatches NoteEditAction move with newBeat and optional newScaleDegree or newOctave when dragging after a note selection', () => {
      const onNoteEdit = vi.fn();
      vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
        kind: 'note',
        measureIndex: 0,
        voiceIndex: 0,
        note: song.measures[0]!.notes[0]![0]!,
      });

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

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

      fireEvent.pointerDown(canvas, {
        clientX: 200,
        clientY: 120,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: 260,
        clientY: 80,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: 260,
        clientY: 80,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const moveCalls = onNoteEdit.mock.calls.filter(([, , ev]) => ev.type === 'move');
      expect(moveCalls.length).toBeGreaterThanOrEqual(1);
      const last = moveCalls[moveCalls.length - 1]![2];
      expect(last).toMatchObject({ type: 'move', noteId });
      expect(last.type === 'move' && Number.isInteger(last.newBeat)).toBe(true);
      const hasVertical =
        last.type === 'move' && (last.newScaleDegree !== undefined || last.newOctave !== undefined);
      expect(hasVertical).toBe(true);
    });

    it('does not dispatch ChordEditAction move when no chord is selected and user drags (error path)', () => {
      const onChordEdit = vi.fn();
      vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue(null);

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={onChordEdit}
          onNoteEdit={vi.fn()}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);

      fireEvent.pointerDown(canvas, {
        clientX: 40,
        clientY: 40,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: 120,
        clientY: 40,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: 120,
        clientY: 40,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const moveChord = onChordEdit.mock.calls.filter(([, ev]) => ev.type === 'move');
      expect(moveChord).toHaveLength(0);
    });
  });

  describe('drag resize', () => {
    it('dispatches ChordEditAction resize with newDuration positive and not exceeding measure capacity after horizontal resize drag', () => {
      const onChordEdit = vi.fn();
      vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
        kind: 'chord',
        measureIndex: 0,
        chord: song.measures[0]!.chords[0]!,
      });

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'chord', measureIndex: 0, eventIds: [chordId] }}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={onChordEdit}
          onNoteEdit={vi.fn()}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);

      /* TPQN=48 → ~80px-wide block at 1×; trailing resize strip is the last 8px [72,80] in grid space (+40px pitch gutter in client X). */
      fireEvent.pointerDown(canvas, {
        clientX: 116,
        clientY: 40,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: 196,
        clientY: 40,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: 196,
        clientY: 40,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const resizeCalls = onChordEdit.mock.calls.filter(([, ev]) => ev.type === 'resize');
      expect(resizeCalls.length).toBeGreaterThanOrEqual(1);
      const last = resizeCalls[resizeCalls.length - 1]![1];
      expect(last.type).toBe('resize');
      if (last.type === 'resize') {
        expect(last.chordId).toBe(chordId);
        expect(last.newDuration).toBeGreaterThanOrEqual(1);
        expect(last.newDuration).toBeLessThanOrEqual(192);
      }
    });

    it('OB-3: trailing-edge note resize dispatches NoteEditAction resize with clamped newDuration', () => {
      const onNoteEdit = vi.fn();
      const wideSong = makeSongWithChordAndNote(chordId, noteId, { beat: 48, duration: 96 });
      const n0 = wideSong.measures[0]!.notes[0]![0]!;
      vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
        kind: 'note',
        measureIndex: 0,
        voiceIndex: 0,
        note: n0,
      });

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

      const { container } = render(
        <EditorCanvas
          song={wideSong}
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
      /* Block starts at tick 48 → 40px; width 96 ticks → 80px; trailing strip last 8px → clientX 40+115..123 */
      fireEvent.pointerDown(canvas, {
        clientX: 155,
        clientY: 120,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: 235,
        clientY: 120,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: 235,
        clientY: 120,
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
        expect(last.newDuration).toBeGreaterThanOrEqual(1);
        expect(last.newDuration).toBeLessThanOrEqual(144);
      }
    });

    it('OB-3: leading-edge note resize dispatches update with beat+duration (fixed end tick)', () => {
      const onNoteEdit = vi.fn();
      const wideSong = makeSongWithChordAndNote(chordId, noteId, { beat: 48, duration: 96 });
      const n0 = wideSong.measures[0]!.notes[0]![0]!;
      vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
        kind: 'note',
        measureIndex: 0,
        voiceIndex: 0,
        note: n0,
      });

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

      const { container } = render(
        <EditorCanvas
          song={wideSong}
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
      /* Leading strip is first 8px of block: grid vx ∈ [40, 48) → clientX 80..88 */
      fireEvent.pointerDown(canvas, {
        clientX: 83,
        clientY: 120,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: 123,
        clientY: 120,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: 123,
        clientY: 120,
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
        expect(last.changes.beat).toBe(96);
        expect(last.changes.duration).toBe(48);
      }
    });
  });

  describe('SongStore wiring', () => {
    it('updates Zustand song when onChordEdit and onNoteEdit are wired to editChord and editNote after a chord move interaction', () => {
      vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
        kind: 'chord',
        measureIndex: 0,
        chord: song.measures[0]!.chords[0]!,
      });

      function Harness() {
        const storeSong = useSongStore((s) => s.song);
        return (
          <EditorCanvas
            song={storeSong}
            viewport={DEFAULT_VIEWPORT}
            selection={{ type: 'chord', measureIndex: 0, eventIds: [chordId] }}
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

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

      const { container } = render(<Harness />);

      const canvas = canvasIn(container);

      fireEvent.pointerDown(canvas, {
        clientX: 40,
        clientY: 40,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: 120,
        clientY: 40,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: 120,
        clientY: 40,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const edited = useSongStore.getState().song.measures[0]!.chords[0]!;
      expect(edited.id).toBe(chordId);
      expect(edited.beat).not.toBe(0);
    });
  });

  describe('OB-4 — viewport stable during pointer drag', () => {
    it('does not call onViewportChange during a completed note move drag (shell-owned viewport must not churn per tick)', () => {
      const onViewportChange = vi.fn();
      const onNoteEdit = vi.fn();
      vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
        kind: 'note',
        measureIndex: 0,
        voiceIndex: 0,
        note: song.measures[0]!.notes[0]![0]!,
      });

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

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
          onViewportChange={onViewportChange}
        />,
      );

      const canvas = canvasIn(container);

      fireEvent.pointerDown(canvas, {
        clientX: 200,
        clientY: 120,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: 260,
        clientY: 80,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: 260,
        clientY: 80,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      expect(onNoteEdit.mock.calls.some(([, , ev]) => ev.type === 'move')).toBe(true);
      expect(onViewportChange).not.toHaveBeenCalled();
    });
  });

  describe('viewport / selection props (TASK-2.11 note)', () => {
    it('accepts Viewport and Selection | null props and renders without throwing so parent can own state per INTERFACES.md', () => {
      const { container, rerender } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);
      expect(canvas).toBeTruthy();

      rerender(
        <EditorCanvas
          song={song}
          viewport={{ ...DEFAULT_VIEWPORT, zoom: 1.25, scrollY: 12 }}
          selection={{ type: 'chord', measureIndex: 0, eventIds: [chordId] }}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      expect(container.querySelectorAll('canvas[role="application"]').length).toBeGreaterThan(0);
    });
  });
});
