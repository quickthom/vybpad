/*
 * QA COVERAGE PLAN — TASK-1A.3
 *
 * Criterion 1: chordToMidiNotes — diatonic triads & keys
 *   happy: C I, D ii, vii° dim, aug, G major I produce expected MIDI pitch sets
 *   error: N/A (pure function; no error contract in INTERFACES)
 *   edges: default voicing octave; explicit voicingOctave shifts register
 *
 * Criterion 2: Seventh chords (maj7, min7, dom7, dim7)
 *   happy: four chord types yield four notes at expected MIDI numbers in C major context
 *   edges: seventh + suspension combinations where applicable
 *
 * Criterion 3: Inversions (PAT-011)
 *   happy: root / 1st / 2nd for triads; 3rd for seventh chords; lowest note role
 *   edges: inversion 3 on triad clamps to max valid inversion
 *
 * Criterion 4–5: Suspensions & additions
 *   happy: sus2/sus4 replace third; add9/add11/add13 add expected classes
 *
 * Criterion 6: Borrowed chords
 *   happy: borrowed mode changes root spelling vs parent scale (e.g. ♭VI)
 *
 * Criterion 7–8: getDiatonicQuality / getDiatonicSeventh
 *   happy: major & natural minor scale degrees match Roman numeral theory
 *
 * Criterion 9: Purity — repeated calls identical; no observable globals
 *
 * Criterion 10: getScaleIntervals from scales.ts
 *   happy: module is invoked when computing diatonic helpers (live binding / spy)
 */

import type { ChordEvent } from '@vybpad/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  chordToMidiNotes,
  getDiatonicQuality,
  getDiatonicSeventh,
} from '../../../../src/engine/theory/chords';
import * as scales from '../../../../src/engine/theory/scales';

function chord(overrides: Partial<ChordEvent>): ChordEvent {
  return {
    id: '00000000-0000-4000-8000-000000000001',
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
    ...overrides,
  };
}

describe('chord construction — TASK-1A.3 — diatonic triads and keys', () => {
  describe('happy path', () => {
    it('returns MIDI 60, 64, 67 for C major triad (degree 1, major) in C major at octave 4', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([60, 64, 67]);
    });

    it('returns D, F, A as D minor triad (degree 2, minor) in C major', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 2, quality: 'minor' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([62, 65, 69]);
    });

    it('returns B, D, F as diminished triad on degree 7 in C major', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 7, quality: 'diminished' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([71, 74, 77]);
    });

    it('returns B, D#, and an augmented fifth (+8 semitones) for explicit augmented quality on degree 7 in C major', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 7, quality: 'augmented' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([71, 75, 79]);
    });

    it('returns G, B, D for degree 1 major triad in G major', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major' }),
        'G',
        'major',
        4,
      );
      expect(notes).toEqual([67, 71, 74]);
    });
  });

  describe('edge cases', () => {
    it('uses voicingOctave to shift all chord tones by whole octaves relative to the harmony center', () => {
      const lower = chordToMidiNotes(chord({ scaleDegree: 1, quality: 'major' }), 'C', 'major', 3);
      const higher = chordToMidiNotes(chord({ scaleDegree: 1, quality: 'major' }), 'C', 'major', 4);
      expect(lower.map((n) => n + 12)).toEqual(higher);
    });
  });
});

describe('chord construction — TASK-1A.3 — seventh chords', () => {
  describe('happy path', () => {
    it('returns Cmaj7 as C, E, G, B (four notes)', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', seventh: 'maj7' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([60, 64, 67, 71]);
    });

    it('returns Dm7 as D, F, A, C (four notes)', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 2, quality: 'minor', seventh: 'min7' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([62, 65, 69, 72]);
    });

    it('returns G7 (dom7) as G, B, D, F (four notes)', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 5, quality: 'major', seventh: 'dom7' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([67, 71, 74, 77]);
    });

    it('returns Bdim7 as B, D, F, A♭ (four notes)', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 7, quality: 'diminished', seventh: 'dim7' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([71, 74, 77, 80]);
    });
  });
});

describe('chord construction — TASK-1A.3 — inversions (PAT-011)', () => {
  describe('happy path', () => {
    it('in inversion 0 (root position) places the chord root as the lowest note', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', inversion: 0 }),
        'C',
        'major',
        4,
      );
      expect(notes[0]).toBe(60);
    });

    it('in inversion 1 moves the bottom chord tone up one octave (first inversion)', () => {
      const root = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', inversion: 0 }),
        'C',
        'major',
        4,
      );
      const first = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', inversion: 1 }),
        'C',
        'major',
        4,
      );
      expect(root).toEqual([60, 64, 67]);
      expect(first).toEqual([64, 67, 72]);
      expect(first[0] % 12).toBe(4);
    });

    it('in inversion 2 moves the bottom two chord tones up one octave (second inversion)', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', inversion: 2 }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([67, 72, 76]);
    });

    it('in inversion 3 for a seventh chord moves the bottom three chord tones up one octave', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', seventh: 'maj7', inversion: 3 }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([71, 72, 76, 79]);
    });
  });

  describe('edge cases', () => {
    it('clamps inversion 3 on a triad to the maximum valid inversion for three notes', () => {
      const second = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', inversion: 2 }),
        'C',
        'major',
        4,
      );
      const clamped = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', inversion: 3 }),
        'C',
        'major',
        4,
      );
      expect(clamped).toEqual(second);
    });
  });
});

describe('chord construction — TASK-1A.3 — suspensions', () => {
  describe('happy path', () => {
    it('uses sus2 chord tones 1, 2, 5 (replaces the third with the second)', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', suspension: 'sus2' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([60, 62, 67]);
    });

    it('uses sus4 chord tones 1, 4, 5 (replaces the third with the fourth)', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', suspension: 'sus4' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([60, 65, 67]);
    });
  });
});

describe('chord construction — TASK-1A.3 — additions', () => {
  describe('happy path', () => {
    it('add9 adds the major ninth (same as second above root) to the voicing', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', addition: 'add9' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([60, 62, 64, 67]);
    });

    it('add11 adds the perfect fourth above the root', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', addition: 'add11' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([60, 64, 65, 67]);
    });

    it('add13 adds the major sixth above the root', () => {
      const notes = chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', addition: 'add13' }),
        'C',
        'major',
        4,
      );
      expect(notes).toEqual([60, 64, 67, 69]);
    });
  });
});

describe('chord construction — TASK-1A.3 — borrowed chords', () => {
  describe('happy path', () => {
    it('uses parallel minor scale degrees for the root when borrowed is minor', () => {
      const notes = chordToMidiNotes(
        chord({
          scaleDegree: 6,
          quality: 'minor',
          borrowed: 'minor',
        }),
        'C',
        'major',
        4,
      );
      expect(notes[0] % 12).toBe(8);
      expect(notes).toEqual([68, 71, 75]);
    });
  });
});

describe('chord construction — TASK-1A.3 — getDiatonicQuality', () => {
  describe('happy path', () => {
    it('returns major-scale triad qualities I–VII as I major, ii–iii minor, IV–V major, vi minor, vii diminished', () => {
      expect(getDiatonicQuality(1, 'major')).toBe('major');
      expect(getDiatonicQuality(2, 'major')).toBe('minor');
      expect(getDiatonicQuality(3, 'major')).toBe('minor');
      expect(getDiatonicQuality(4, 'major')).toBe('major');
      expect(getDiatonicQuality(5, 'major')).toBe('major');
      expect(getDiatonicQuality(6, 'major')).toBe('minor');
      expect(getDiatonicQuality(7, 'major')).toBe('diminished');
    });

    it('returns natural minor triad qualities i–VII as i minor, ii°, III major, iv–v minor, VI–VII major', () => {
      expect(getDiatonicQuality(1, 'minor')).toBe('minor');
      expect(getDiatonicQuality(2, 'minor')).toBe('diminished');
      expect(getDiatonicQuality(3, 'minor')).toBe('major');
      expect(getDiatonicQuality(4, 'minor')).toBe('minor');
      expect(getDiatonicQuality(5, 'minor')).toBe('minor');
      expect(getDiatonicQuality(6, 'minor')).toBe('major');
      expect(getDiatonicQuality(7, 'minor')).toBe('major');
    });
  });
});

describe('chord construction — TASK-1A.3 — getDiatonicSeventh', () => {
  describe('happy path', () => {
    it('returns expected seventh types for each degree of the major scale', () => {
      expect(getDiatonicSeventh(1, 'major')).toBe('maj7');
      expect(getDiatonicSeventh(2, 'major')).toBe('min7');
      expect(getDiatonicSeventh(3, 'major')).toBe('min7');
      expect(getDiatonicSeventh(4, 'major')).toBe('maj7');
      expect(getDiatonicSeventh(5, 'major')).toBe('dom7');
      expect(getDiatonicSeventh(6, 'major')).toBe('min7');
      expect(getDiatonicSeventh(7, 'major')).toBe('min7b5');
    });

    it('returns expected seventh types for each degree of the natural minor scale', () => {
      expect(getDiatonicSeventh(1, 'minor')).toBe('min7');
      expect(getDiatonicSeventh(2, 'minor')).toBe('min7b5');
      expect(getDiatonicSeventh(3, 'minor')).toBe('maj7');
      expect(getDiatonicSeventh(4, 'minor')).toBe('min7');
      expect(getDiatonicSeventh(5, 'minor')).toBe('min7');
      expect(getDiatonicSeventh(6, 'minor')).toBe('maj7');
      expect(getDiatonicSeventh(7, 'minor')).toBe('dom7');
    });
  });
});

describe('chord construction — TASK-1A.3 — purity', () => {
  describe('happy path', () => {
    it('returns identical MIDI arrays when chordToMidiNotes is called repeatedly with the same inputs', () => {
      const c = chord({ scaleDegree: 4, quality: 'major', seventh: 'dom7', inversion: 1 });
      const a = chordToMidiNotes(c, 'F#', 'mixolydian', 4);
      const b = chordToMidiNotes(c, 'F#', 'mixolydian', 4);
      expect(a).toEqual(b);
    });

    it('returns identical diatonic metadata when getters are called repeatedly', () => {
      expect(getDiatonicQuality(5, 'lydian')).toBe(getDiatonicQuality(5, 'lydian'));
      expect(getDiatonicSeventh(3, 'dorian')).toBe(getDiatonicSeventh(3, 'dorian'));
    });
  });
});

describe('chord construction — TASK-1A.3 — scales integration', () => {
  describe('happy path', () => {
    it('invokes getScaleIntervals from scales.ts when computing diatonic quality and seventh', () => {
      const spy = vi.spyOn(scales, 'getScaleIntervals');
      getDiatonicQuality(3, 'major');
      getDiatonicSeventh(5, 'minor');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('invokes getScaleIntervals from scales.ts when resolving chord roots via scaleDegreeToMidi', () => {
      const spy = vi.spyOn(scales, 'getScaleIntervals');
      chordToMidiNotes(
        chord({ scaleDegree: 3, quality: 'minor', seventh: 'min7' }),
        'E',
        'mixolydian',
        4,
      );
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
