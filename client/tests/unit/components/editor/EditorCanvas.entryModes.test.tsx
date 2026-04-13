/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — TASK-2.9
 *
 * Criterion 1: Table mode — after digit 1–7, onSelectionChange advances caret (collapsed range at next beat)
 * Criterion 2: Text mode — duration before digit; no auto-advance (no tableModeAdvanceRange on text chord add)
 * Criterion 3: Tab → onToggleEntryMode / onEntryModeToggle
 * Criterion 4: entryMode table vs text behavior
 * Criterion 5: Tab suppressed for editable targets (input, textarea, contenteditable)
 * Criterion 6: onChordEdit / onNoteEdit add actions
 *
 * Contract: handleEditorKeydown (exported) + INTERFACES Selection / edit actions.
 */

import { randomUUID } from 'node:crypto';

import type { ChordEvent, NoteEvent, SongData, Viewport } from '@vybpad/shared';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorCanvas } from '../../../../src/components/editor/EditorCanvas';
import { type EditorKeyboardContext, handleEditorKeydown } from '../../../../src/hooks/useKeyboard';
import { buildDefaultSong, useSongStore } from '../../../../src/store/songStore';

const DEFAULT_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};

function baseSongTemplate(): Omit<SongData, 'measures'> {
  return {
    version: '1.0',
    metadata: {
      title: 'T',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
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

function emptyMeasuresTail(count: number): SongData['measures'] {
  return Array.from({ length: count }, () => ({
    id: randomUUID(),
    chords: [],
    notes: [[], [], [], []] as [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]],
  }));
}

function makeSongEmptyFirstMeasure(): SongData {
  return {
    ...baseSongTemplate(),
    measures: [
      {
        id: randomUUID(),
        chords: [],
        notes: [[], [], [], []],
      },
      ...emptyMeasuresTail(7),
    ],
  };
}

function chordEvent(
  id: string,
  beat: number,
  duration: number,
  scaleDegree: ChordEvent['scaleDegree'] = 1,
): ChordEvent {
  return {
    id,
    scaleDegree,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat,
    duration,
  };
}

function noteEvent(id: string, beat: number, duration: number, scaleDegree: NoteEvent['scaleDegree'] = 3): NoteEvent {
  return {
    id,
    scaleDegree,
    octave: 0,
    chromatic: 0,
    beat,
    duration,
    isRest: false,
    velocity: 100,
  };
}

function makeSongChordAndNote(chord: ChordEvent, note: NoteEvent): SongData {
  return {
    ...baseSongTemplate(),
    measures: [
      {
        id: randomUUID(),
        chords: [chord],
        notes: [[note], [], [], []],
      },
      ...emptyMeasuresTail(7),
    ],
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

function keydown(key: string, target: EventTarget = document.body): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'target', { value: target, enumerable: true });
  return ev;
}

function baseCtx(overrides: Partial<EditorKeyboardContext> = {}): EditorKeyboardContext {
  return {
    song: makeSongEmptyFirstMeasure(),
    viewport: DEFAULT_VIEWPORT,
    selection: null,
    activeVoice: 0,
    entryMode: 'table',
    currentDurationTicks: 48,
    setCurrentDurationTicks: vi.fn(),
    keyboardTargetMeasureRef: { current: null },
    textDurationArmedRef: { current: false },
    onChordEdit: vi.fn(),
    onNoteEdit: vi.fn(),
    onSelectionChange: vi.fn(),
    ...overrides,
  };
}

describe('TASK-2.9 entry modes — handleEditorKeydown (contract)', () => {
  it('table mode: after chord digit, onSelectionChange receives collapsed range at next beat (beat + duration)', () => {
    const onChordEdit = vi.fn();
    const onSelectionChange = vi.fn();
    const ctx = baseCtx({ onChordEdit, onSelectionChange });

    handleEditorKeydown(keydown('4'), ctx);

    expect(onChordEdit).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        type: 'add',
        chord: expect.objectContaining({ scaleDegree: 4, beat: 0, duration: 48 }),
      }),
    );
    expect(onSelectionChange).toHaveBeenCalledWith({
      type: 'range',
      measureIndex: 0,
      rangeStart: 48,
      rangeEnd: 48,
    });
  });

  it('table mode: consecutive digits with getSongAfterMutation (store) append two chords (TASK-4.2 persistence)', () => {
    useSongStore.getState().loadSong(makeSongEmptyFirstMeasure());
    const onSelectionChange = vi.fn();
    const buildCtx = (): EditorKeyboardContext =>
      baseCtx({
        song: useSongStore.getState().song,
        onChordEdit: useSongStore.getState().editChord,
        onSelectionChange,
        getSongAfterMutation: () => useSongStore.getState().song,
      });

    handleEditorKeydown(keydown('1'), buildCtx());
    handleEditorKeydown(keydown('2'), buildCtx());

    const chords = useSongStore.getState().song.measures[0]?.chords ?? [];
    expect(chords.length).toBe(2);
    expect(chords.map((c) => c.scaleDegree).sort((a, b) => a - b)).toEqual([1, 2]);

    useSongStore.getState().loadSong(buildDefaultSong());
  });

  it('table mode: consecutive digits use fresh selection snapshots even if the rendered prop is stale', () => {
    const renderedSong = makeSongEmptyFirstMeasure();
    let currentSong = structuredClone(renderedSong);
    let currentSelection: EditorKeyboardContext['selection'] = null;
    const onSelectionChange = vi.fn((next) => {
      currentSelection = next;
    });
    const onChordEdit = vi.fn<EditorKeyboardContext['onChordEdit']>((measureIndex, event) => {
      if (event.type !== 'add') return;
      const measure = currentSong.measures[measureIndex];
      if (!measure) return;
      measure.chords.push({ ...event.chord, id: randomUUID() });
      measure.chords.sort((a, b) => a.beat - b.beat);
    });
    const ctx = baseCtx({
      song: renderedSong,
      selection: { type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 96 },
      onChordEdit,
      onSelectionChange,
      getSongAfterMutation: () => currentSong,
      getSelectionAfterMutation: () => currentSelection,
    });

    handleEditorKeydown(keydown('1'), ctx);
    handleEditorKeydown(keydown('2'), ctx);

    const chords = currentSong.measures[0]?.chords ?? [];
    expect(chords).toHaveLength(2);
    expect(chords.map((c) => ({ scaleDegree: c.scaleDegree, beat: c.beat }))).toEqual([
      { scaleDegree: 1, beat: 0 },
      { scaleDegree: 2, beat: 48 },
    ]);
  });

  it('table mode: after note digit append, onSelectionChange receives collapsed range at next beat', () => {
    const chordId = randomUUID();
    const noteId = randomUUID();
    const song = makeSongChordAndNote(chordEvent(chordId, 0, 48), noteEvent(noteId, 48, 24, 3));
    const onNoteEdit = vi.fn();
    const onSelectionChange = vi.fn();
    const ctx = baseCtx({
      song,
      selection: { type: 'note', measureIndex: 0, eventIds: [noteId] },
      onNoteEdit,
      onSelectionChange,
    });

    handleEditorKeydown(keydown('2'), ctx);

    expect(onNoteEdit).toHaveBeenCalledWith(
      0,
      0,
      expect.objectContaining({
        type: 'add',
        note: expect.objectContaining({ scaleDegree: 2, beat: 72, duration: 48 }),
      }),
    );
    expect(onSelectionChange).toHaveBeenCalledWith({
      type: 'range',
      measureIndex: 0,
      rangeStart: 120,
      rangeEnd: 120,
    });
  });

  it('table mode: advance reflects current duration after ; then digit (12 ticks)', () => {
    const onChordEdit = vi.fn();
    const onSelectionChange = vi.fn();
    const ctx = baseCtx({ onChordEdit, onSelectionChange });

    handleEditorKeydown(keydown(';'), ctx);
    expect(ctx.setCurrentDurationTicks).toHaveBeenCalledWith(12);

    const ctx2 = baseCtx({ onChordEdit, onSelectionChange, currentDurationTicks: 12 });
    handleEditorKeydown(keydown('6'), ctx2);

    expect(onChordEdit).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        type: 'add',
        chord: expect.objectContaining({ scaleDegree: 6, beat: 0, duration: 12 }),
      }),
    );
    expect(onSelectionChange).toHaveBeenCalledWith({
      type: 'range',
      measureIndex: 0,
      rangeStart: 12,
      rangeEnd: 12,
    });
  });

  it('text mode: k then digit dispatches chord add and does not auto-advance selection', () => {
    const onChordEdit = vi.fn();
    const onSelectionChange = vi.fn();
    const ctx = baseCtx({
      entryMode: 'text',
      onChordEdit,
      onSelectionChange,
    });

    handleEditorKeydown(keydown('k'), ctx);
    expect(ctx.textDurationArmedRef.current).toBe(true);
    handleEditorKeydown(keydown('5'), ctx);

    expect(onChordEdit).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        type: 'add',
        chord: expect.objectContaining({ scaleDegree: 5, beat: 0 }),
      }),
    );
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('text mode: digit alone does not dispatch chord add', () => {
    const onChordEdit = vi.fn();
    const ctx = baseCtx({ entryMode: 'text', onChordEdit });

    handleEditorKeydown(keydown('3'), ctx);
    expect(onChordEdit).not.toHaveBeenCalled();
  });

  it('Tab invokes onToggleEntryMode when wired and target is not editable', () => {
    const onToggleEntryMode = vi.fn();
    const canvas = document.createElement('canvas');
    const ctx = baseCtx({ onToggleEntryMode });

    handleEditorKeydown(keydown('Tab', canvas), ctx);
    expect(onToggleEntryMode).toHaveBeenCalledTimes(1);
  });

  it('Tab does not invoke onToggleEntryMode when keydown target is input or textarea', () => {
    const onToggleEntryMode = vi.fn();
    const ctx = baseCtx({ onToggleEntryMode });

    const input = document.createElement('input');
    handleEditorKeydown(keydown('Tab', input), ctx);
    expect(onToggleEntryMode).not.toHaveBeenCalled();

    onToggleEntryMode.mockClear();
    const ta = document.createElement('textarea');
    handleEditorKeydown(keydown('Tab', ta), ctx);
    expect(onToggleEntryMode).not.toHaveBeenCalled();
  });

  it('Tab does not invoke onToggleEntryMode when target is contenteditable', () => {
    const onToggleEntryMode = vi.fn();
    const ctx = baseCtx({ onToggleEntryMode });
    const ce = document.createElement('div');
    document.body.appendChild(ce);
    Object.defineProperty(ce, 'isContentEditable', {
      configurable: true,
      get: () => true,
    });
    try {
      handleEditorKeydown(keydown('Tab', ce), ctx);
      expect(onToggleEntryMode).not.toHaveBeenCalled();
    } finally {
      ce.remove();
    }
  });

  it('onEntryModeToggle alias works when onToggleEntryMode is omitted', () => {
    const onEntryModeToggle = vi.fn();
    const ctx = baseCtx({ onEntryModeToggle });
    handleEditorKeydown(keydown('Tab', document.body), ctx);
    expect(onEntryModeToggle).toHaveBeenCalledTimes(1);
  });
});

describe('TASK-2.9 — EditorCanvas entryMode prop (smoke)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubCanvas2d();
  });

  afterEach(() => {
    cleanup();
  });

  it('accepts entryMode "table" | "text" per INTERFACES.EditorCanvasProps', () => {
    mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
    const { unmount } = render(
      <EditorCanvas
        song={makeSongEmptyFirstMeasure()}
        viewport={DEFAULT_VIEWPORT}
        selection={null}
        playbackTick={null}
        activeVoice={0}
        entryMode="text"
        showGuides={false}
        colorScheme="diatonic"
        onChordEdit={vi.fn()}
        onNoteEdit={vi.fn()}
        onSelectionChange={vi.fn()}
        onViewportChange={vi.fn()}
      />,
    );
    unmount();
  });
});
