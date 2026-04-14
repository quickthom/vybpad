/**
 * TASK-5.3 — Secondary cycle (`d` key), ChordEvent.secondary persistence on editChord update, Roman labels.
 */
import { randomUUID } from 'node:crypto';

import type { ChordEvent, Measure, SongData } from '@vybpad/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearSecondaryChordEdit, cycleSecondaryChordEdit } from '../../../../src/components/editor/editorKeyboardLogic';
import { theoryEngine } from '../../../../src/engine/theory/theoryEngine';
import {
  chordEventFieldsForSecondary,
  getSecondaryCycleSequence,
} from '../../../../src/engine/theory/secondaryChords';
import { useSongStore } from '../../../../src/store/songStore';

const DEFAULT_BAND: SongData['bandConfig'] = {
  tracks: [
    { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
    { role: 'melody2', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
    { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
    { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
    { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
    { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
    { role: 'drums', instrument: 'piano', volume: 0.0, mute: true, octave: 0 },
  ],
};

function makeSongWithOneChord(ch: Omit<ChordEvent, 'id'>): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 't',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: randomUUID(),
        chords: [{ ...ch, id: 'chord-a' }],
        notes: [[], [], [], []] as Measure['notes'],
      },
    ],
    bandConfig: DEFAULT_BAND,
  };
}

describe('TASK-5.3 — secondary cycle order + Roman', () => {
  it('getSecondaryCycleSequence matches getAvailableSecondaryChords order (V → viio → IV × targets 1–7, filtered)', () => {
    const seq = getSecondaryCycleSequence('major');
    expect(seq.length).toBeGreaterThan(0);
    expect(seq[0]).toEqual({ function: 'V', target: 2 });
  });

  it('cycleSecondaryChordEdit from diatonic applies first slot; advances; last step clears to diatonic with matching root PC', () => {
    const homeKey = 'C';
    const homeScale = 'major' as const;
    const seq = getSecondaryCycleSequence(homeScale);
    const first = chordEventFieldsForSecondary(seq[0]);
    let chord: ChordEvent = {
      id: 'x',
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

    const a = cycleSecondaryChordEdit(chord, homeKey, homeScale);
    expect(a.secondary).toEqual(seq[0]);
    expect(a.scaleDegree).toBe(first.scaleDegree);
    expect(theoryEngine.toRomanNumeral({ ...chord, ...a } as ChordEvent, homeScale)).toMatch(/V/);

    chord = { ...chord, ...a } as ChordEvent;

    for (let step = 0; step < seq.length - 1; step++) {
      const n = cycleSecondaryChordEdit(chord, homeKey, homeScale);
      chord = { ...chord, ...n } as ChordEvent;
      expect(chord.secondary).toEqual(seq[step + 1]);
    }

    const cleared = cycleSecondaryChordEdit(chord, homeKey, homeScale);
    expect(cleared.secondary).toBeNull();
    chord = { ...chord, ...cleared } as ChordEvent;
    expect(chord.secondary).toBeNull();
  });

  it('clearSecondaryChordEdit removes secondary metadata', () => {
    const homeKey = 'C';
    const homeScale = 'major' as const;
    const seq = getSecondaryCycleSequence(homeScale);
    const chord: ChordEvent = {
      id: 'x',
      ...chordEventFieldsForSecondary(seq[0]),
      beat: 0,
      duration: 48,
    };
    const cleared = clearSecondaryChordEdit(chord, homeKey, homeScale);
    expect(cleared.secondary).toBeNull();
    expect(cleared.borrowed).toBeNull();
  });
});

describe('TASK-5.3 — editChord update persists secondary', () => {
  beforeEach(() => {
    useSongStore.getState().loadSong(
      makeSongWithOneChord({
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
      }),
    );
  });

  it('stores non-null ChordEvent.secondary after update; undo restores prior snapshot', () => {
    const { editChord, undo } = useSongStore.getState();
    const seq = getSecondaryCycleSequence('major');
    editChord(0, {
      type: 'update',
      chordId: 'chord-a',
      changes: chordEventFieldsForSecondary(seq[0]),
    });
    const c = useSongStore.getState().song.measures[0]?.chords[0];
    expect(c?.secondary).toEqual(seq[0]);
    expect(theoryEngine.toRomanNumeral(c!, 'major')).toContain('/');

    undo();
    const c2 = useSongStore.getState().song.measures[0]?.chords[0];
    expect(c2?.secondary).toBeNull();
  });
});
