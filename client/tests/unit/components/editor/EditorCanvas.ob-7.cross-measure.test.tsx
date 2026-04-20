/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — OB-7 / OB-9
 *
 * Criterion: Move/resize interactions should survive barline crossing for note+chord.
 *           Move preview should be driven during pointer move (not only on pointerUp).
 */
import { randomUUID } from 'node:crypto';

import type { ChordEvent, NoteEvent, SongData, Viewport } from '@vybpad/shared';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorCanvas } from '../../../../src/components/editor/EditorCanvas';
import * as hitTestModule from '../../../../src/engine/renderer/hitTest';
import { PITCH_GUTTER_WIDTH } from '../../../../src/engine/renderer/constants';
import {
  absoluteTickFromMeasurePosition,
  getMeterAtMeasure,
  horizontalPxToTicks,
  horizontalTicksToPx,
  measureLengthInTicks,
} from '../../../../src/engine/renderer/layout';
import { layoutChordBlock } from '../../../../src/engine/renderer/chordBlocks';
import { computeNoteBlockRect } from '../../../../src/engine/renderer/noteBlocks';
import { trailingResizeStripWidthPx } from '../../../../src/components/editor/pointerMath';
import { getMeasureStartTicks, measureIndexFromAbsoluteTick } from '../../../../src/engine/renderer/tickUtils';

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
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(full);
}

function canvasIn(container: HTMLElement): HTMLCanvasElement {
  const el = container.querySelector('canvas');
  if (!el) throw new Error('Editor canvas not found in container');
  return el as HTMLCanvasElement;
}

function stubCanvas2d() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId) => {
    if (contextId !== '2d') return null;
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

describe('EditorCanvas — OB-7 cross-measure drag', () => {
  let song: SongData;
  let chordId: string;
  let noteId: string;

  beforeEach(() => {
    chordId = randomUUID();
    noteId = randomUUID();
    song = makeSongWithChordAndNote(chordId, noteId);
    vi.restoreAllMocks();
    stubCanvas2d();
  });

  afterEach(() => {
    cleanup();
  });

  it('remaps chord move to destination beat + measure when dragging across a barline', () => {
    const crossSong = structuredClone(song);
    crossSong.measures[1]!.changes = { meter: { numerator: 3, denominator: 4 } };
    const chord = crossSong.measures[0]!.chords[0]!;
    chord.beat = 160;

    const dragTicks = 80;
    const fromLocal = chord.beat;
    const fromAbsolute = absoluteTickFromMeasurePosition(crossSong, 0, fromLocal);
    const snappedDragTicks = horizontalPxToTicks(horizontalTicksToPx(dragTicks, DEFAULT_VIEWPORT.zoom), DEFAULT_VIEWPORT.zoom);
    const destinationAbsolute = fromAbsolute + snappedDragTicks;

    const starts = getMeasureStartTicks(crossSong);
    const expectedMeasure = measureIndexFromAbsoluteTick(crossSong, destinationAbsolute);
    const expectedBeat = destinationAbsolute - (starts[expectedMeasure] ?? 0);
    const chordRect = layoutChordBlock(chord, 0, crossSong, DEFAULT_VIEWPORT);
    const downX = PITCH_GUTTER_WIDTH + chordRect.x + chordRect.width / 2;
    const downY = chordRect.y + chordRect.height / 2;

    vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
      kind: 'chord',
      measureIndex: 0,
      chord,
    });

    const onChordEdit = vi.fn();
    mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 600 });

    const { container } = render(
      <EditorCanvas
        song={crossSong}
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
    const dragVx = horizontalTicksToPx(snappedDragTicks, DEFAULT_VIEWPORT.zoom);

    fireEvent.pointerDown(canvas, {
      clientX: downX,
      clientY: downY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(canvas, {
      clientX: downX + dragVx,
      clientY: downY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(canvas, {
      clientX: downX + dragVx,
      clientY: downY,
      button: 0,
      buttons: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });
    const moveCalls = onChordEdit.mock.calls.filter(([, action]) => action.type === 'move');
    expect(moveCalls.length).toBeGreaterThan(0);
    const [targetMeasure, payload] = moveCalls[moveCalls.length - 1]!;
    expect(targetMeasure).toBe(expectedMeasure);
    expect(payload).toMatchObject({ type: 'move', chordId });
    if (payload.type === 'move') {
      expect(payload.newBeat).toBe(expectedBeat);
    }
  });

  it('remaps note move destination beat when a note is dragged across measure boundaries', () => {
    const crossSong = structuredClone(song);
    crossSong.measures[1]!.changes = { meter: { numerator: 3, denominator: 4 } };
    const note = crossSong.measures[0]!.notes[0]![0]!;
    note.beat = 160;

    const dragTicks = 80;
    const fromAbsolute = absoluteTickFromMeasurePosition(crossSong, 0, note.beat);
    const snappedDragTicks = horizontalPxToTicks(horizontalTicksToPx(dragTicks, DEFAULT_VIEWPORT.zoom), DEFAULT_VIEWPORT.zoom);
    const destinationAbsolute = fromAbsolute + snappedDragTicks;
    const starts = getMeasureStartTicks(crossSong);
    const expectedBeat = destinationAbsolute - (starts[measureIndexFromAbsoluteTick(crossSong, destinationAbsolute)] ?? 0);
    const noteRect = computeNoteBlockRect({
      song: crossSong,
      viewport: DEFAULT_VIEWPORT,
      measureIndex: 0,
      note,
      isRest: false,
      voiceIndex: 0,
      melodyRowHeight: 20,
    });
    const downX = PITCH_GUTTER_WIDTH + noteRect.x + noteRect.width / 2;
    const downY = noteRect.y + noteRect.height / 2;

    vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
      kind: 'note',
      measureIndex: 0,
      voiceIndex: 0,
      note,
    });

    const onNoteEdit = vi.fn();
    mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 600 });

    const { container } = render(
      <EditorCanvas
        song={crossSong}
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
    const dragVx = horizontalTicksToPx(snappedDragTicks, DEFAULT_VIEWPORT.zoom);

    fireEvent.pointerDown(canvas, {
      clientX: downX,
      clientY: downY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(canvas, {
      clientX: downX + dragVx,
      clientY: downY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(canvas, {
      clientX: downX + dragVx,
      clientY: downY,
      button: 0,
      buttons: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const moveCalls = onNoteEdit.mock.calls.filter(([, , action]) => action.type === 'move');
    expect(moveCalls.length).toBeGreaterThan(0);
    const [, , payload] = moveCalls[moveCalls.length - 1]!;
    expect(payload).toMatchObject({ type: 'move', noteId });
    if (payload.type === 'move') {
      expect(payload.newBeat).toBe(expectedBeat);
    }
  });

  it('dispatches move preview frames while pointer moves across a barline (OB-9)', () => {
    const crossSong = structuredClone(song);
    crossSong.measures[1]!.changes = { meter: { numerator: 3, denominator: 4 } };
    const chord = crossSong.measures[0]!.chords[0]!;
    chord.beat = 160;
    const chordRect = layoutChordBlock(chord, 0, crossSong, DEFAULT_VIEWPORT);
    const downX = PITCH_GUTTER_WIDTH + chordRect.x + chordRect.width / 2;
    const downY = chordRect.y + chordRect.height / 2;

    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
      kind: 'chord',
      measureIndex: 0,
      chord,
    });

    const onChordEdit = vi.fn();
    mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 600 });

    const { container } = render(
      <EditorCanvas
        song={crossSong}
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
    const moveX = downX + horizontalTicksToPx(80, DEFAULT_VIEWPORT.zoom);

    fireEvent.pointerDown(canvas, {
      clientX: downX,
      clientY: downY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
    });
    expect(rafSpy).toHaveBeenCalledTimes(0);

    fireEvent.pointerMove(canvas, {
      clientX: moveX,
      clientY: downY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
    });
    expect(rafSpy).toHaveBeenCalled();
    fireEvent.pointerUp(canvas, {
      clientX: moveX,
      clientY: downY,
      button: 0,
      buttons: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(rafSpy).toHaveBeenCalledTimes(2);
    const moveCalls = onChordEdit.mock.calls.filter(([, action]) => action.type === 'move');
    expect(moveCalls.length).toBe(1);
  });

  it('does not clamp chord trailing resize at source-measure boundary when drag crosses a barline', () => {
    const crossSong = structuredClone(song);
    crossSong.measures[1]!.changes = { meter: { numerator: 3, denominator: 4 } };
    const chord = crossSong.measures[0]!.chords[0]!;
    chord.beat = 160;
    chord.duration = 24;

    const chordRect = layoutChordBlock(chord, 0, crossSong, DEFAULT_VIEWPORT);
    const strip = trailingResizeStripWidthPx(chordRect.width);
    const startX = PITCH_GUTTER_WIDTH + chordRect.x + chordRect.width - Math.max(1, strip);

    const dragTicks = 120;
    const onChordEdit = vi.fn();
    vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
      kind: 'chord',
      measureIndex: 0,
      chord,
    });
    mockCanvasLayout({ left: 0, top: 0, width: 1400, height: 600 });

    const { container } = render(
      <EditorCanvas
        song={crossSong}
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
    const moveX = startX + horizontalTicksToPx(dragTicks, DEFAULT_VIEWPORT.zoom);

    fireEvent.pointerDown(canvas, {
      clientX: startX,
      clientY: 40,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(canvas, {
      clientX: moveX,
      clientY: 40,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(canvas, {
      clientX: moveX,
      clientY: 40,
      button: 0,
      buttons: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const resizeCalls = onChordEdit.mock.calls.filter(([, action]) => action.type === 'resize');
    expect(resizeCalls.length).toBe(1);
    const [, action] = resizeCalls[0]!;
    const sourceCapacity = measureLengthInTicks(getMeterAtMeasure(crossSong, 0)) - chord.beat;
    expect(action).toMatchObject({ type: 'resize', chordId });
    if (action.type === 'resize') {
      expect(action.newDuration).toBeGreaterThan(sourceCapacity);
    }
  });
});
