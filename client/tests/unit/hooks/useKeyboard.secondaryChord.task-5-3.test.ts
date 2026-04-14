/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — Task 5.3
 *
 * Criterion 1: `d` cycles secondary applied chord types/targets when a chord is selected; ChordEvent.secondary updated via ChordEditAction
 *   happy: each KeyD advances secondary in the same order as getAvailableSecondaryChords(home scale); wraps to null after last
 *   error: note selection, range selection, or no selection — no ChordEditAction for secondary from `d`
 *   edges: table vs text entry mode (both should cycle when chord selected per UX parity with digit entry)
 *
 * Criterion 3: Roman label reflects secondary via public TheoryEngine.toRomanNumeral
 *   happy: non-null secondary yields a slash in the Roman string for a representative V/V case
 */

import type { ChordEvent, SecondaryChord, SongData, Viewport } from '@vybpad/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { theoryEngine } from '../../../src/engine/theory';
import { getAvailableSecondaryChords } from '../../../src/engine/theory/secondaryChords';
import { type EditorKeyboardContext, handleEditorKeydown } from '../../../src/hooks/useKeyboard';

const DEFAULT_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};

function baseSong(chord: ChordEvent): SongData {
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
        id: 'measure-0',
        chords: [chord],
        notes: [[], [], [], []],
      },
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

/** Expected next secondary when pressing `d`, matching the palette order used for applied chords (Task 5.3). */
function nextSecondaryAfter(
  current: SecondaryChord | null,
  scale: SongData['metadata']['scale'],
): SecondaryChord | null {
  const list: SecondaryChord[] = getAvailableSecondaryChords(scale).map(({ function: fn, target }) => ({
    function: fn,
    target,
  }));
  if (current === null) {
    return list[0] ?? null;
  }
  const idx = list.findIndex((s) => s.function === current.function && s.target === current.target);
  if (idx < 0) return list[0] ?? null;
  if (idx + 1 < list.length) return list[idx + 1]!;
  return null;
}

function fireD(ctx: EditorKeyboardContext): void {
  const e = new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', bubbles: true, cancelable: true });
  handleEditorKeydown(e, ctx);
}

function makeCtx(overrides: Partial<EditorKeyboardContext> & Pick<EditorKeyboardContext, 'song' | 'selection'>): EditorKeyboardContext {
  const keyboardTargetMeasureRef = { current: null as number | null };
  const textDurationArmedRef = { current: false };
  return {
    viewport: DEFAULT_VIEWPORT,
    activeVoice: 0,
    entryMode: 'table',
    currentDurationTicks: 48,
    setCurrentDurationTicks: vi.fn(),
    keyboardTargetMeasureRef,
    textDurationArmedRef,
    onChordEdit: vi.fn(),
    onNoteEdit: vi.fn(),
    onSelectionChange: vi.fn(),
    ...overrides,
  };
}

describe('secondary chord keyboard — Task 5.3 — d key cycles ChordEditAction.secondary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('happy path', () => {
    it('dispatches update with the first available SecondaryChord when d is pressed with a chord selected and secondary was null', () => {
      const chordId = 'chord-a';
      const chord: ChordEvent = {
        id: chordId,
        scaleDegree: 5,
        quality: 'major',
        seventh: 'none',
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: null,
        beat: 0,
        duration: 48,
      };
      const onChordEdit = vi.fn();
      const ctx = makeCtx({
        song: baseSong(chord),
        selection: { type: 'chord', measureIndex: 0, eventIds: [chordId] },
        onChordEdit,
      });
      fireD(ctx);
      const expected = nextSecondaryAfter(null, 'major');
      expect(expected).not.toBeNull();
      expect(onChordEdit).toHaveBeenCalledWith(0, {
        type: 'update',
        chordId,
        changes: expect.objectContaining({ secondary: expected }),
      });
    });

    it('dispatches update advancing to the next SecondaryChord on each d press following the palette order for the song scale', () => {
      const chordId = 'chord-b';
      let secondary: SecondaryChord | null = null;
      const chord: ChordEvent = {
        id: chordId,
        scaleDegree: 5,
        quality: 'major',
        seventh: 'none',
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: null,
        beat: 0,
        duration: 48,
      };
      const onChordEdit = vi.fn();
      const palette = getAvailableSecondaryChords('major').map(({ function: fn, target }) => ({ function: fn, target }));
      expect(palette.length).toBeGreaterThan(1);

      for (let step = 0; step < palette.length; step++) {
        onChordEdit.mockClear();
        const song = baseSong({ ...chord, secondary });
        const ctx = makeCtx({
          song,
          selection: { type: 'chord', measureIndex: 0, eventIds: [chordId] },
          onChordEdit,
        });
        fireD(ctx);
        secondary = nextSecondaryAfter(secondary, 'major');
        expect(onChordEdit).toHaveBeenCalledTimes(1);
        expect(onChordEdit).toHaveBeenCalledWith(0, {
          type: 'update',
          chordId,
          changes: expect.objectContaining({ secondary }),
        });
      }
    });

    it('dispatches update with secondary null when d is pressed after the last palette entry (clear secondary path)', () => {
      const chordId = 'chord-c';
      const palette = getAvailableSecondaryChords('major').map(({ function: fn, target }) => ({ function: fn, target }));
      const last = palette[palette.length - 1];
      expect(last).toBeDefined();

      const chord: ChordEvent = {
        id: chordId,
        scaleDegree: 5,
        quality: 'major',
        seventh: 'none',
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: last,
        beat: 0,
        duration: 48,
      };
      const onChordEdit = vi.fn();
      const ctx = makeCtx({
        song: baseSong(chord),
        selection: { type: 'chord', measureIndex: 0, eventIds: [chordId] },
        onChordEdit,
      });
      fireD(ctx);
      expect(onChordEdit).toHaveBeenCalledWith(0, {
        type: 'update',
        chordId,
        changes: expect.objectContaining({ secondary: null }),
      });
    });
  });

  describe('error handling', () => {
    it('does not dispatch chord edit when d is pressed with a note selected', () => {
      const chordId = 'chord-d';
      const noteId = 'note-d';
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
        duration: 48,
      };
      const onChordEdit = vi.fn();
      const ctx = makeCtx({
        song: {
          ...baseSong(chord),
          measures: [
            {
              id: 'measure-0',
              chords: [chord],
              notes: [
                [
                  {
                    id: noteId,
                    scaleDegree: 3,
                    octave: 0,
                    chromatic: 0,
                    beat: 48,
                    duration: 24,
                    isRest: false,
                    velocity: 100,
                  },
                ],
                [],
                [],
                [],
              ],
            },
          ],
        },
        selection: { type: 'note', measureIndex: 0, eventIds: [noteId] },
        onChordEdit,
      });
      fireD(ctx);
      expect(onChordEdit).not.toHaveBeenCalled();
    });

    it('does not dispatch chord edit when d is pressed with no selection', () => {
      const chordId = 'chord-e';
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
        duration: 48,
      };
      const onChordEdit = vi.fn();
      const ctx = makeCtx({
        song: baseSong(chord),
        selection: null,
        onChordEdit,
      });
      fireD(ctx);
      expect(onChordEdit).not.toHaveBeenCalled();
    });

    it('does not dispatch chord edit when d is pressed with a range selection', () => {
      const chordId = 'chord-f';
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
        duration: 48,
      };
      const onChordEdit = vi.fn();
      const ctx = makeCtx({
        song: baseSong(chord),
        selection: { type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 },
        onChordEdit,
      });
      fireD(ctx);
      expect(onChordEdit).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('suppresses d when an input is focused (editable keyboard target)', () => {
      const chordId = 'chord-g';
      const chord: ChordEvent = {
        id: chordId,
        scaleDegree: 5,
        quality: 'major',
        seventh: 'none',
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: null,
        beat: 0,
        duration: 48,
      };
      const onChordEdit = vi.fn();
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const ctx = makeCtx({
        song: baseSong(chord),
        selection: { type: 'chord', measureIndex: 0, eventIds: [chordId] },
        onChordEdit,
      });
      fireD(ctx);
      expect(onChordEdit).not.toHaveBeenCalled();
      input.remove();
    });
  });
});

describe('TheoryEngine — Task 5.3 — toRomanNumeral reflects SecondaryChord', () => {
  describe('happy path', () => {
    it('returns a Roman string containing slash notation for a V/V applied chord in major', () => {
      const chord: ChordEvent = {
        id: 'x',
        scaleDegree: 5,
        quality: 'major',
        seventh: 'none',
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: { function: 'V', target: 5 },
        beat: 0,
        duration: 48,
      };
      const label = theoryEngine.toRomanNumeral(chord, 'major');
      expect(label).toContain('/');
      expect(label).toMatch(/V\/V/);
    });
  });
});
