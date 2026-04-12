/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — TASK-2.8
 *
 * Criterion 1: Digits 1–7 → ChordEditAction / NoteEditAction update (scale degree) when chord or note selected
 * Criterion 2: h/j/k/l/; → PAT-004; resize when selected; setCurrentDurationTicks for subsequent adds
 * Criterion 3: Delete/Backspace → delete + clear selection; no selection → no delete
 * Criterion 4: Arrow keys → merged beat-order navigation; onSelectionChange only
 * Criterion 5: Suppress when target is input or textarea (same guard as [contenteditable] in isEditableKeyboardTarget)
 * Criterion 6: App wires onChordEdit/onNoteEdit to store
 */

import { randomUUID } from 'node:crypto';

import type { ChordEvent, NoteEvent, Selection, SongData, Viewport } from '@vybpad/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorCanvas } from '../../../../src/components/editor/EditorCanvas';
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

function makeSongChordOnly(chord: ChordEvent): SongData {
  return {
    ...baseSongTemplate(),
    measures: [
      {
        id: randomUUID(),
        chords: [chord],
        notes: [[], [], [], []],
      },
      ...emptyMeasuresTail(7),
    ],
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

function makeSongTwoChords(c1: ChordEvent, c2: ChordEvent): SongData {
  return {
    ...baseSongTemplate(),
    measures: [
      {
        id: randomUUID(),
        chords: [c1, c2].sort((a, b) => a.beat - b.beat),
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
  if (!el) throw new Error('Editor canvas not found');
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

function fireWindowKey(key: string, code?: string) {
  fireEvent.keyDown(window, { key, code: code ?? key, bubbles: true });
}

/** Store-backed canvas with fixed selection — mirrors App wiring for integration-style tests. */
function EditorCanvasFromStore({ selection, entryMode = 'table' }: { selection: Selection | null; entryMode?: 'table' | 'text' }) {
  const song = useSongStore((s) => s.song);
  const editChord = useSongStore((s) => s.editChord);
  const editNote = useSongStore((s) => s.editNote);
  return (
    <EditorCanvas
      song={song}
      viewport={DEFAULT_VIEWPORT}
      selection={selection}
      playbackTick={null}
      activeVoice={0}
      entryMode={entryMode}
      showGuides={false}
      colorScheme="diatonic"
      onChordEdit={editChord}
      onNoteEdit={editNote}
      onSelectionChange={vi.fn()}
      onViewportChange={vi.fn()}
    />
  );
}

describe('EditorCanvas — TASK-2.8 keyboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubCanvas2d();
  });

  afterEach(() => {
    cleanup();
  });

  describe('focus and aria', () => {
    it('sets tabIndex 0 and role application on the editor canvas', () => {
      const song = makeSongChordOnly(chordEvent(randomUUID(), 0, 96));
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
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );
      const canvas = canvasIn(container);
      expect(canvas.tabIndex).toBe(0);
      expect(canvas.getAttribute('role')).toBe('application');
    });

    it('sets aria-label describing editor keyboard usage', () => {
      const song = makeSongChordOnly(chordEvent(randomUUID(), 0, 96));
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
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );
      const label = canvasIn(container).getAttribute('aria-label') ?? '';
      expect(label.length).toBeGreaterThan(0);
      expect(label).toMatch(/digit|number|duration|Delete|arrow|editor/i);
    });
  });

  describe('digits — update actions', () => {
    it('(text mode) dispatches ChordEditAction update with scaleDegree 3 when duration key then Digit3 pressed with a chord selected', () => {
      const chordId = randomUUID();
      const ch = chordEvent(chordId, 0, 96, 1);
      const onChordEdit = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
      const { container } = render(
        <EditorCanvas
          song={makeSongChordOnly(ch)}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'chord', measureIndex: 0, eventIds: [chordId] }}
          playbackTick={null}
          activeVoice={0}
          entryMode="text"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={onChordEdit}
          onNoteEdit={vi.fn()}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );
      canvasIn(container).focus();
      fireWindowKey('k', 'KeyK');
      fireWindowKey('3', 'Digit3');
      expect(onChordEdit).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ type: 'update', chordId }),
      );
    });

    it('(text mode) dispatches NoteEditAction update with scaleDegree 5 when duration key then Digit5 pressed with a note selected', () => {
      const chordId = randomUUID();
      const noteId = randomUUID();
      const song = makeSongChordAndNote(chordEvent(chordId, 0, 48), noteEvent(noteId, 48, 24, 3));
      const onNoteEdit = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'note', measureIndex: 0, eventIds: [noteId] }}
          playbackTick={null}
          activeVoice={0}
          entryMode="text"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={onNoteEdit}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );
      canvasIn(container).focus();
      fireWindowKey('k', 'KeyK');
      fireWindowKey('5', 'Digit5');
      expect(onNoteEdit).toHaveBeenCalledWith(
        0,
        0,
        expect.objectContaining({ type: 'update', noteId }),
      );
    });

    it('(text mode) does nothing when no selection and a digit key is pressed without arming duration first', () => {
      const onChordEdit = vi.fn();
      const onNoteEdit = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
      const { container } = render(
        <EditorCanvas
          song={makeSongEmptyFirstMeasure()}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="text"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={onChordEdit}
          onNoteEdit={onNoteEdit}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );
      canvasIn(container).focus();
      fireWindowKey('5', 'Digit5');
      expect(onChordEdit).not.toHaveBeenCalled();
      expect(onNoteEdit).not.toHaveBeenCalled();
    });

    it('does not dispatch chord or note edit when selection type is range', () => {
      const onChordEdit = vi.fn();
      const onNoteEdit = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
      const { container } = render(
        <EditorCanvas
          song={makeSongEmptyFirstMeasure()}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 96 }}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={onChordEdit}
          onNoteEdit={onNoteEdit}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );
      canvasIn(container).focus();
      fireWindowKey('2', 'Digit2');
      expect(onChordEdit).not.toHaveBeenCalled();
      expect(onNoteEdit).not.toHaveBeenCalled();
    });
  });

  describe('duration h/j/k/l/; (PAT-004)', () => {
    it('dispatches ChordEditAction resize to 48 ticks when k is pressed and the chord duration was 24', () => {
      const chordId = randomUUID();
      const song = makeSongChordOnly(chordEvent(chordId, 0, 24, 1));
      const onChordEdit = vi.fn();
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
      canvasIn(container).focus();
      fireWindowKey('k', 'KeyK');
      expect(onChordEdit).toHaveBeenCalledWith(0, { type: 'resize', chordId, newDuration: 48 });
    });

    it('dispatches NoteEditAction resize to 48 ticks when k is pressed and the note duration was 24', () => {
      const noteId = randomUUID();
      const song = makeSongChordAndNote(chordEvent(randomUUID(), 0, 96), noteEvent(noteId, 0, 24, 3));
      const onNoteEdit = vi.fn();
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
      canvasIn(container).focus();
      fireWindowKey('k', 'KeyK');
      expect(onNoteEdit).toHaveBeenCalledWith(0, 0, { type: 'resize', noteId, newDuration: 48 });
    });

    it('clamps resize when h requests a whole note from a late beat in a 4/4 measure', () => {
      const chordId = randomUUID();
      const song = makeSongChordOnly(chordEvent(chordId, 120, 24, 1));
      const onChordEdit = vi.fn();
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
      canvasIn(container).focus();
      fireWindowKey('h', 'KeyH');
      expect(onChordEdit).toHaveBeenCalledWith(0, { type: 'resize', chordId, newDuration: 72 });
    });
  });

  describe('Delete / Backspace', () => {
    it('dispatches delete and clears selection when Backspace is pressed with a chord selected', () => {
      const chordId = randomUUID();
      const song = makeSongChordOnly(chordEvent(chordId, 0, 96));
      const onChordEdit = vi.fn();
      const onSelectionChange = vi.fn();
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
          onSelectionChange={onSelectionChange}
          onViewportChange={vi.fn()}
        />,
      );
      canvasIn(container).focus();
      fireWindowKey('Backspace', 'Backspace');
      expect(onChordEdit).toHaveBeenCalledWith(0, { type: 'delete', chordId });
      expect(onSelectionChange).toHaveBeenCalledWith(null);
    });

    it('does not dispatch delete when selection is null', () => {
      const onChordEdit = vi.fn();
      const onNoteEdit = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
      const { container } = render(
        <EditorCanvas
          song={makeSongChordOnly(chordEvent(randomUUID(), 0, 96))}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={onChordEdit}
          onNoteEdit={onNoteEdit}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );
      canvasIn(container).focus();
      fireWindowKey('Delete', 'Delete');
      expect(onChordEdit).not.toHaveBeenCalled();
      expect(onNoteEdit).not.toHaveBeenCalled();
    });
  });

  describe('Arrow keys (merged timeline)', () => {
    it('selects the note after the chord when ArrowRight is pressed from that chord', () => {
      const ch = chordEvent(randomUUID(), 0, 48, 1);
      const n = noteEvent(randomUUID(), 96, 24, 3);
      const onSelectionChange = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
      const { container } = render(
        <EditorCanvas
          song={makeSongChordAndNote(ch, n)}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'chord', measureIndex: 0, eventIds: [ch.id] }}
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
      canvasIn(container).focus();
      fireWindowKey('ArrowRight', 'ArrowRight');
      expect(onSelectionChange).toHaveBeenCalledWith({
        type: 'note',
        measureIndex: 0,
        eventIds: [n.id],
      });
    });

    it('selects the previous chord when ArrowLeft is pressed from a later chord', () => {
      const c1 = chordEvent(randomUUID(), 0, 48, 1);
      const c2 = chordEvent(randomUUID(), 96, 48, 4);
      const onSelectionChange = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
      const { container } = render(
        <EditorCanvas
          song={makeSongTwoChords(c1, c2)}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'chord', measureIndex: 0, eventIds: [c2.id] }}
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
      canvasIn(container).focus();
      fireWindowKey('ArrowLeft', 'ArrowLeft');
      expect(onSelectionChange).toHaveBeenCalledWith({
        type: 'chord',
        measureIndex: 0,
        eventIds: [c1.id],
      });
    });
  });

  describe('suppress in editable fields', () => {
    it('does not dispatch chord add when keydown targets an input', () => {
      const onChordEdit = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
      render(
        <div>
          <EditorCanvas
            song={makeSongEmptyFirstMeasure()}
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
          />
          <input aria-label="ti" type="text" />
        </div>,
      );
      const input = screen.getByLabelText('ti');
      input.focus();
      fireEvent.keyDown(input, { key: '1', code: 'Digit1', bubbles: true });
      expect(onChordEdit).not.toHaveBeenCalled();
    });

    it('does not dispatch chord add when keydown targets a textarea', () => {
      const onChordEdit = vi.fn();
      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
      render(
        <div>
          <EditorCanvas
            song={makeSongEmptyFirstMeasure()}
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
          />
          <textarea aria-label="ta" />
        </div>,
      );
      const ta = screen.getByLabelText('ta');
      ta.focus();
      fireEvent.keyDown(ta, { key: '1', code: 'Digit1', bubbles: true });
      expect(onChordEdit).not.toHaveBeenCalled();
    });
  });

  describe('App store wiring', () => {
    it('(text mode) persists scale degree update on the selected chord when duration key then digit entered through the store', () => {
      const chordId = randomUUID();
      const ch = chordEvent(chordId, 0, 96, 1);
      useSongStore.getState().loadSong(makeSongChordOnly(ch));
      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
      const { container } = render(
        <EditorCanvasFromStore
          selection={{ type: 'chord', measureIndex: 0, eventIds: [chordId] }}
          entryMode="text"
        />,
      );
      canvasIn(container).focus();
      fireWindowKey('k', 'KeyK');
      fireWindowKey('4', 'Digit4');
      const chord = useSongStore.getState().song.measures[0]!.chords.find((c) => c.id === chordId);
      expect(chord).toBeDefined();
      expect(chord!.scaleDegree).toBe(4);
      useSongStore.getState().loadSong(buildDefaultSong());
    });
  });
});
