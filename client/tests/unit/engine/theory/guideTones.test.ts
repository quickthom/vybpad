import type { ChordEvent, ScaleDegree, ScaleType } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';
import { getChordTones, getGuideCompatibility } from '../../../../src/engine/theory/guideTones';

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

describe('TASK-1A.6 — getChordTones', () => {
  it('returns [1, 3, 5] for a major triad on I in major', () => {
    const c = chord({ scaleDegree: 1, quality: 'major', seventh: 'none' });
    expect(getChordTones(c, 'major')).toEqual([1, 3, 5]);
  });

  it('returns [2, 4, 6, 1] for ii7 in major (Dm7 in C)', () => {
    const c = chord({ scaleDegree: 2, quality: 'minor', seventh: 'min7' });
    expect(getChordTones(c, 'major')).toEqual([2, 4, 6, 1]);
  });

  it('uses borrowed mode for root spelling when mapping chord tones', () => {
    const c = chord({
      scaleDegree: 6,
      quality: 'major',
      seventh: 'none',
      borrowed: 'minor',
    });
    const tones = getChordTones(c, 'major');
    expect(tones).toHaveLength(3);
    expect(tones[0]).toBeGreaterThanOrEqual(1);
    expect(tones[0]).toBeLessThanOrEqual(7);
  });
});

describe('TASK-1A.6 — getGuideCompatibility', () => {
  it('returns chord-tone when pitch class matches a chord tone', () => {
    const c = chord({ scaleDegree: 1, quality: 'major', seventh: 'none' });
    expect(getGuideCompatibility(1, 0, c, 'major')).toBe('chord-tone');
    expect(getGuideCompatibility(3, 0, c, 'major')).toBe('chord-tone');
    expect(getGuideCompatibility(5, 0, c, 'major')).toBe('chord-tone');
  });

  it('returns scale-tone when diatonic but not a chord tone', () => {
    const c = chord({ scaleDegree: 1, quality: 'major', seventh: 'none' });
    expect(getGuideCompatibility(2, 0, c, 'major')).toBe('scale-tone');
    expect(getGuideCompatibility(4, 0, c, 'major')).toBe('scale-tone');
  });

  it('returns chromatic when pitch class is outside the scale', () => {
    const c = chord({ scaleDegree: 1, quality: 'major', seventh: 'none' });
    expect(getGuideCompatibility(1, 1, c, 'major')).toBe('chromatic');
    expect(getGuideCompatibility(4, 1, c, 'major')).toBe('chromatic');
  });
});

describe('TASK-1A.6 — all scale types', () => {
  const scaleTypes: ScaleType[] = [
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

  it('getChordTones returns seven 1–7 degrees for each scale (I major triad)', () => {
    const c = chord({ scaleDegree: 1, quality: 'major', seventh: 'none' });
    for (const st of scaleTypes) {
      const tones = getChordTones(c, st);
      expect(tones).toHaveLength(3);
      for (const d of tones) {
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(7);
      }
    }
  });

  it('getGuideCompatibility classifies root as chord-tone vs scale for each scale', () => {
    const c = chord({ scaleDegree: 1, quality: 'major', seventh: 'none' });
    for (const st of scaleTypes) {
      expect(getGuideCompatibility(1, 0, c, st)).toBe('chord-tone');
      const other: ScaleDegree = 2;
      expect(getGuideCompatibility(other, 0, c, st)).toBe('scale-tone');
    }
  });
});
