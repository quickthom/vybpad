/*
 * QA COVERAGE PLAN — TASK-1A.6
 *
 * Criterion 1: getChordTones — diatonic triads
 *   happy: I in major [1,3,5]; ii in major [2,4,6]
 *   error: N/A (pure function; no error contract in INTERFACES)
 *
 * Criterion 2: getChordTones — sevenths, sus, add
 *   happy: V7 dom7 [5,7,2,4]; ii7 [2,4,6,1]; Isus4 [1,4,5]; Iadd9 multiset {1,2,3,5} when sorted
 *
 * Criterion 3: getChordTones — borrowed
 *   happy: iv with borrowed minor in major → scale degrees [1,4,6] when sorted (Fm in C: F Ab C)
 *
 * Criterion 4–6: getGuideCompatibility
 *   happy: chord-tone / scale-tone / chromatic cases from brief + ii in minor / dorian
 *
 * Criterion 7: all nine ScaleType values
 *   happy: I major triad yields three degrees and root is chord-tone in each scale
 */

import type { ChordEvent, ScaleDegree, ScaleType } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';
import { getChordTones, getGuideCompatibility } from '../../../../src/engine/theory/guideTones';

const ALL_SCALE_TYPES: ScaleType[] = [
  'major',
  'minor',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'locrian',
  'harmonicMinor',
  'phrygianDominant',
];

function makeChord(overrides: Partial<ChordEvent> = {}): ChordEvent {
  return {
    id: 'test-chord',
    scaleDegree: 1 as ScaleDegree,
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

function sortDegrees(degrees: ScaleDegree[]): ScaleDegree[] {
  return [...degrees].sort((a, b) => a - b);
}

describe('guide tones — TASK-1A.6 — getChordTones diatonic triads', () => {
  describe('happy path', () => {
    it('returns [1, 3, 5] for I major triad in major', () => {
      const chord = makeChord({ scaleDegree: 1, quality: 'major' });
      expect(getChordTones(chord, 'major')).toEqual([1, 3, 5]);
    });

    it('returns [2, 4, 6] for ii minor triad in major', () => {
      const chord = makeChord({ scaleDegree: 2, quality: 'minor' });
      expect(getChordTones(chord, 'major')).toEqual([2, 4, 6]);
    });

    it('returns [1, 3, 5] for i minor triad in natural minor', () => {
      const chord = makeChord({ scaleDegree: 1, quality: 'minor' });
      expect(getChordTones(chord, 'minor')).toEqual([1, 3, 5]);
    });
  });
});

describe('guide tones — TASK-1A.6 — getChordTones sevenths, sus, and add', () => {
  describe('happy path', () => {
    it('returns [5, 7, 2, 4] for V7 (dom7) in major', () => {
      const chord = makeChord({
        scaleDegree: 5,
        quality: 'major',
        seventh: 'dom7',
      });
      expect(getChordTones(chord, 'major')).toEqual([5, 7, 2, 4]);
    });

    it('returns [2, 4, 6, 1] for ii7 (minor seventh) in major', () => {
      const chord = makeChord({
        scaleDegree: 2,
        quality: 'minor',
        seventh: 'min7',
      });
      expect(getChordTones(chord, 'major')).toEqual([2, 4, 6, 1]);
    });

    it('returns [1, 4, 5] for Isus4 in major', () => {
      const chord = makeChord({
        scaleDegree: 1,
        quality: 'major',
        suspension: 'sus4',
      });
      expect(getChordTones(chord, 'major')).toEqual([1, 4, 5]);
    });

    it('returns scale degrees {1, 2, 3, 5} for Iadd9 in major (sorted order)', () => {
      const chord = makeChord({
        scaleDegree: 1,
        quality: 'major',
        addition: 'add9',
      });
      expect(sortDegrees(getChordTones(chord, 'major'))).toEqual([1, 2, 3, 5]);
    });
  });
});

describe('guide tones — TASK-1A.6 — getChordTones borrowed chords', () => {
  describe('happy path', () => {
    it('returns [1, 4, 6] sorted for iv borrowed from parallel minor in major context', () => {
      const chord = makeChord({
        scaleDegree: 4,
        quality: 'minor',
        borrowed: 'minor',
      });
      expect(sortDegrees(getChordTones(chord, 'major'))).toEqual([1, 4, 6]);
    });
  });
});

describe('guide tones — TASK-1A.6 — getChordTones harmonic minor', () => {
  describe('happy path', () => {
    it('returns [7, 2, 4] for viio diminished triad in harmonic minor', () => {
      const chord = makeChord({
        scaleDegree: 7,
        quality: 'diminished',
      });
      expect(getChordTones(chord, 'harmonicMinor')).toEqual([7, 2, 4]);
    });
  });
});

describe('guide tones — TASK-1A.6 — getGuideCompatibility', () => {
  describe('happy path', () => {
    it('returns "chord-tone" for degree 1 chromatic 0 over I major in major', () => {
      const chord = makeChord({ scaleDegree: 1, quality: 'major' });
      expect(getGuideCompatibility(1, 0, chord, 'major')).toBe('chord-tone');
    });

    it('returns "scale-tone" for degree 2 chromatic 0 over I major in major', () => {
      const chord = makeChord({ scaleDegree: 1, quality: 'major' });
      expect(getGuideCompatibility(2, 0, chord, 'major')).toBe('scale-tone');
    });

    it('returns "chromatic" for degree 1 chromatic 1 over I major in major (raised tonic)', () => {
      const chord = makeChord({ scaleDegree: 1, quality: 'major' });
      expect(getGuideCompatibility(1, 1, chord, 'major')).toBe('chromatic');
    });

    it('returns "chord-tone" for degree 4 chromatic 0 over Isus4 in major', () => {
      const chord = makeChord({
        scaleDegree: 1,
        quality: 'major',
        suspension: 'sus4',
      });
      expect(getGuideCompatibility(4, 0, chord, 'major')).toBe('chord-tone');
    });

    it('returns "chord-tone" for degree 2 chromatic 0 over ii° root in natural minor', () => {
      const chord = makeChord({
        scaleDegree: 2,
        quality: 'diminished',
      });
      expect(getGuideCompatibility(2, 0, chord, 'minor')).toBe('chord-tone');
    });

    it('returns "chord-tone" for degree 4 chromatic 0 over ii minor triad in dorian (third of ii)', () => {
      const chord = makeChord({
        scaleDegree: 2,
        quality: 'minor',
      });
      expect(getGuideCompatibility(4, 0, chord, 'dorian')).toBe('chord-tone');
    });
  });
});

describe('guide tones — TASK-1A.6 — all nine scale types', () => {
  it('getChordTones yields three degrees and getGuideCompatibility marks I major root as chord-tone', () => {
    const chord = makeChord({ scaleDegree: 1, quality: 'major' });

    for (const scale of ALL_SCALE_TYPES) {
      expect(getChordTones(chord, scale)).toHaveLength(3);
      expect(getGuideCompatibility(1, 0, chord, scale)).toBe('chord-tone');
    }
  });
});
