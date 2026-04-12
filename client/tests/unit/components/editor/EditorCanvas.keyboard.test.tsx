/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — TASK-2.8
 *
 * Criterion 1: Scale degree keys 1–7 → ChordEditAction / NoteEditAction update with scaleDegree
 *   happy: chord selected + digit → onChordEdit update; note selected → onNoteEdit update
 *   error: no selection → no onChordEdit / onNoteEdit; range selection → no scale-degree edit (edge)
 *   edges: digits 1 and 7 boundaries
 *
 * Criterion 2: Duration keys q/w/e/r/t → resize with PAT-004 ticks; clamp to measure bounds
 *   happy: chord/note selected → resize with expected ticks (q=192, w=96, e=48, r=24, t=12)
 *   error: no selection → no resize
 *   edges: resize clamped when target duration would exceed measure end
 *
 * Criterion 3: Delete / Backspace → delete action + onSelectionChange(null)
 *   happy: chord or note selected → delete + clear selection
 *   error: no selection → no delete dispatch
 *
 * Criterion 4: Arrow Left/Right → move selection along beat order; only onSelectionChange
 *   happy: second of two chords → Left selects first; chord then note by beat → Right moves to note
 *   error: no selection → no selection change (or stable null — assert no spurious selection)
 *
 * Criterion 5: Focus / a11y — tabIndex 0; aria-label includes keyboard affordance hint
 *   happy: canvas tabIndex 0; aria-label mentions keyboard-related guidance
 *
 * Criterion 6: Hover without drag — pointer move with no session runs hitTestEditorCanvas and updates hover (cursor-grab)
 *   happy: pointerMove without pointerDown calls hitTest; canvas shows grab cursor class when hit
 *
 * Criterion 7: npm test passes after implementation — enforced by CI; baseline fails until then.
 */

import { randomUUID } from 'node:crypto';

import type { ChordEvent, NoteEvent, SongData, Viewport } from '@vybpad/shared';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorCanvas } from '../../../../src/components/editor/EditorCanvas';
import * as hitTestModule from '../../../../src/engine/renderer/hitTest';

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

function makeSongChordThenNote(chord: ChordEvent, note: NoteEvent): SongData {
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

describe('EditorCanvas — TASK-2.8 keyboard interaction (interface contract)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubCanvas2d();
  });

  afterEach(() => {
    cleanup();
  });

  describe('focus and aria (criterion 5)', () => {
    it('sets tabIndex={0} on the editor canvas', () => {
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
    });

    it('sets aria-label to include a keyboard affordance hint', () => {
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
      expect(label).toMatch(/keyboard|shortcut|number key|digit|arrow|key\b/i);
    });
  });

  describe('scale degree keys 1–7 (criterion 1)', () => {
    it('dispatches ChordEditAction update with scaleDegree when a chord is selected and Digit 3 is pressed', () => {
      const chordId = randomUUID();
      const ch = chordEvent(chordId, 0, 96, 1);
      const song = makeSongChordOnly(ch);
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

      canvasIn(container);
      fireEvent.keyDown(window, { key: '3', code: 'Digit3' });

      expect(onChordEdit).toHaveBeenCalledWith(0, {
        type: 'update',
        chordId,
        changes: { scaleDegree: 3 },
      });
    });

    it('dispatches NoteEditAction update with scaleDegree when a note is selected and Digit 7 is pressed', () => {
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
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={onNoteEdit}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      canvasIn(container);
      fireEvent.keyDown(window, { key: '7', code: 'Digit7' });

      expect(onNoteEdit).toHaveBeenCalledWith(0, 0, {
        type: 'update',
        noteId,
        changes: { scaleDegree: 7 },
      });
    });

    it('does not dispatch onChordEdit or onNoteEdit for digit keys when selection is null', () => {
      const song = makeSongChordOnly(chordEvent(randomUUID(), 0, 96));
      const onChordEdit = vi.fn();
      const onNoteEdit = vi.fn();

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
          onNoteEdit={onNoteEdit}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      canvasIn(container);
      fireEvent.keyDown(window, { key: '5', code: 'Digit5' });

      expect(onChordEdit).not.toHaveBeenCalled();
      expect(onNoteEdit).not.toHaveBeenCalled();
    });

    it('does not dispatch scale-degree update when selection type is range (edge case)', () => {
      const chordId = randomUUID();
      const song = makeSongChordOnly(chordEvent(chordId, 0, 96));
      const onChordEdit = vi.fn();

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={{
            type: 'range',
            measureIndex: 0,
            rangeStart: 0,
            rangeEnd: 96,
          }}
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

      canvasIn(container);
      fireEvent.keyDown(window, { key: '2', code: 'Digit2' });

      expect(onChordEdit).not.toHaveBeenCalled();
    });
  });

  describe('duration keys q/w/e/r/t (criterion 2)', () => {
    it('dispatches ChordEditAction resize with newDuration 192 when q is pressed with a chord selected', () => {
      const chordId = randomUUID();
      const song = makeSongChordOnly(chordEvent(chordId, 0, 48, 1));
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
      canvasIn(container);
      fireEvent.keyDown(window, { key: 'q', code: 'KeyQ' });
      expect(onChordEdit).toHaveBeenCalledWith(0, { type: 'resize', chordId, newDuration: 192 });
    });

    it('dispatches ChordEditAction resize with newDuration 96 when w is pressed with a chord selected', () => {
      const chordId = randomUUID();
      const song = makeSongChordOnly(chordEvent(chordId, 0, 48, 1));
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
      canvasIn(container);
      fireEvent.keyDown(window, { key: 'w', code: 'KeyW' });
      expect(onChordEdit).toHaveBeenCalledWith(0, { type: 'resize', chordId, newDuration: 96 });
    });

    it('dispatches ChordEditAction resize with newDuration 48 when e is pressed with a chord selected', () => {
      const chordId = randomUUID();
      const song = makeSongChordOnly(chordEvent(chordId, 0, 48, 1));
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
      canvasIn(container);
      fireEvent.keyDown(window, { key: 'e', code: 'KeyE' });
      expect(onChordEdit).toHaveBeenCalledWith(0, { type: 'resize', chordId, newDuration: 48 });
    });

    it('dispatches ChordEditAction resize with newDuration 24 when r is pressed with a chord selected', () => {
      const chordId = randomUUID();
      const song = makeSongChordOnly(chordEvent(chordId, 0, 48, 1));
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
      canvasIn(container);
      fireEvent.keyDown(window, { key: 'r', code: 'KeyR' });
      expect(onChordEdit).toHaveBeenCalledWith(0, { type: 'resize', chordId, newDuration: 24 });
    });

    it('dispatches ChordEditAction resize with newDuration 12 when t is pressed with a chord selected', () => {
      const chordId = randomUUID();
      const song = makeSongChordOnly(chordEvent(chordId, 0, 48, 1));
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
      canvasIn(container);
      fireEvent.keyDown(window, { key: 't', code: 'KeyT' });
      expect(onChordEdit).toHaveBeenCalledWith(0, { type: 'resize', chordId, newDuration: 12 });
    });

    it('dispatches NoteEditAction resize with newDuration 48 when e is pressed with a note selected', () => {
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

      canvasIn(container);
      fireEvent.keyDown(window, { key: 'e', code: 'KeyE' });

      expect(onNoteEdit).toHaveBeenCalledWith(0, 0, {
        type: 'resize',
        noteId,
        newDuration: 48,
      });
    });

    it('clamps ChordEditAction resize newDuration to the remaining ticks in the measure (4/4 measure, late beat)', () => {
      const chordId = randomUUID();
      /* 4/4 → 192 ticks; chord starts at beat 120, so max duration is 72 */
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

      canvasIn(container);
      fireEvent.keyDown(window, { key: 'q', code: 'KeyQ' });

      expect(onChordEdit).toHaveBeenCalledWith(0, {
        type: 'resize',
        chordId,
        newDuration: 72,
      });
    });
  });

  describe('Delete and Backspace (criterion 3)', () => {
    it('dispatches ChordEditAction delete and onSelectionChange(null) when Backspace is pressed with a chord selected', () => {
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

      canvasIn(container);
      fireEvent.keyDown(window, { key: 'Backspace', code: 'Backspace' });

      expect(onChordEdit).toHaveBeenCalledWith(0, { type: 'delete', chordId });
      expect(onSelectionChange).toHaveBeenCalledWith(null);
    });

    it('dispatches NoteEditAction delete and onSelectionChange(null) when Delete is pressed with a note selected', () => {
      const noteId = randomUUID();
      const song = makeSongChordAndNote(chordEvent(randomUUID(), 0, 96), noteEvent(noteId, 48, 24, 3));
      const onNoteEdit = vi.fn();
      const onSelectionChange = vi.fn();

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
          onSelectionChange={onSelectionChange}
          onViewportChange={vi.fn()}
        />,
      );

      canvasIn(container);
      fireEvent.keyDown(window, { key: 'Delete', code: 'Delete' });

      expect(onNoteEdit).toHaveBeenCalledWith(0, 0, { type: 'delete', noteId });
      expect(onSelectionChange).toHaveBeenCalledWith(null);
    });
  });

  describe('ArrowLeft / ArrowRight selection (criterion 4)', () => {
    it('calls only onSelectionChange with the previous chord when ArrowLeft is pressed and a later chord is selected', () => {
      const c1 = chordEvent(randomUUID(), 0, 48, 1);
      const c2 = chordEvent(randomUUID(), 96, 48, 4);
      const song = makeSongTwoChords(c1, c2);
      const onChordEdit = vi.fn();
      const onNoteEdit = vi.fn();
      const onSelectionChange = vi.fn();

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'chord', measureIndex: 0, eventIds: [c2.id] }}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={onChordEdit}
          onNoteEdit={onNoteEdit}
          onSelectionChange={onSelectionChange}
          onViewportChange={vi.fn()}
        />,
      );

      canvasIn(container);
      fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft' });

      expect(onChordEdit).not.toHaveBeenCalled();
      expect(onNoteEdit).not.toHaveBeenCalled();
      expect(onSelectionChange).toHaveBeenCalledWith({
        type: 'chord',
        measureIndex: 0,
        eventIds: [c1.id],
      });
    });

    it('calls only onSelectionChange with the next event by beat order when ArrowRight is pressed from a chord to a note', () => {
      const ch = chordEvent(randomUUID(), 0, 48, 1);
      const n = noteEvent(randomUUID(), 96, 24, 3);
      const song = makeSongChordThenNote(ch, n);
      const onChordEdit = vi.fn();
      const onNoteEdit = vi.fn();
      const onSelectionChange = vi.fn();

      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={{ type: 'chord', measureIndex: 0, eventIds: [ch.id] }}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={onChordEdit}
          onNoteEdit={onNoteEdit}
          onSelectionChange={onSelectionChange}
          onViewportChange={vi.fn()}
        />,
      );

      canvasIn(container);
      fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' });

      expect(onChordEdit).not.toHaveBeenCalled();
      expect(onNoteEdit).not.toHaveBeenCalled();
      expect(onSelectionChange).toHaveBeenCalledWith({
        type: 'note',
        measureIndex: 0,
        eventIds: [n.id],
      });
    });
  });

  describe('hover without active drag — pointer move hit test (criterion 6)', () => {
    it('calls hitTestEditorCanvas on pointer move when there is no active drag session and applies cursor-grab when the hit is a draggable target', async () => {
      const chordId = randomUUID();
      const ch = chordEvent(chordId, 0, 96);
      const song = makeSongChordOnly(ch);

      const hitSpy = vi.spyOn(hitTestModule, 'hitTestEditorCanvas').mockReturnValue({
        kind: 'chord',
        measureIndex: 0,
        chord: ch,
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
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);

      fireEvent.pointerMove(canvas, {
        clientX: 120,
        clientY: 60,
        pointerId: 1,
        pointerType: 'mouse',
      });

      expect(hitSpy).toHaveBeenCalled();
      await waitFor(() => {
        expect(canvas.className).toContain('cursor-grab');
      });
    });
  });
});
