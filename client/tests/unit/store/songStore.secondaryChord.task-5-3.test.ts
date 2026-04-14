/*
 * QA COVERAGE PLAN — Task 5.3
 *
 * Criterion 2: Clearing secondary (null) via ChordEditAction update; undo/redo restores prior ChordEvent.secondary
 *   happy: update sets secondary:null from non-null; undo restores previous secondary object; redo re-applies null
 *   error: N/A for store (no error contract)
 *   edges: multiple undo steps after cycling secondary edits
 */

import { randomUUID } from 'node:crypto';

import type { ChordEvent, SongData } from '@vybpad/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSongStore } from '../../../src/store/songStore';

function makeSongWithOneChord(chord: ChordEvent): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'Untitled',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: randomUUID(),
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

describe('SongStore — Task 5.3 — secondary on ChordEvent and undo/redo', () => {
  beforeEach(() => {
    const chordId = randomUUID();
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
    useSongStore.getState().loadSong(makeSongWithOneChord(chord));
  });

  describe('happy path', () => {
    it('restores the previous secondary state on undo after clearing secondary to null via update', () => {
      const chordId = useSongStore.getState().song.measures[0]!.chords[0]!.id;
      const applied: ChordEvent['secondary'] = { function: 'V', target: 5 };

      useSongStore.getState().editChord(0, {
        type: 'update',
        chordId,
        changes: { secondary: applied },
      });
      expect(useSongStore.getState().song.measures[0]!.chords[0]!.secondary).toEqual(applied);

      useSongStore.getState().editChord(0, {
        type: 'update',
        chordId,
        changes: { secondary: null },
      });
      expect(useSongStore.getState().song.measures[0]!.chords[0]!.secondary).toBeNull();

      useSongStore.getState().undo();
      expect(useSongStore.getState().song.measures[0]!.chords[0]!.secondary).toEqual(applied);
    });

    it('re-applies null secondary on redo after undo from a cleared secondary', () => {
      const chordId = useSongStore.getState().song.measures[0]!.chords[0]!.id;

      useSongStore.getState().editChord(0, {
        type: 'update',
        chordId,
        changes: { secondary: { function: 'V', target: 5 } },
      });
      useSongStore.getState().editChord(0, {
        type: 'update',
        chordId,
        changes: { secondary: null },
      });

      useSongStore.getState().undo();
      expect(useSongStore.getState().song.measures[0]!.chords[0]!.secondary).toEqual({
        function: 'V',
        target: 5,
      });

      useSongStore.getState().redo();
      expect(useSongStore.getState().song.measures[0]!.chords[0]!.secondary).toBeNull();
    });
  });
});
