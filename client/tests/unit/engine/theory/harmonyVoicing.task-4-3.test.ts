/*
 * QA COVERAGE PLAN — 4.3
 *
 * Criterion 1: Close voicing + inversion + bass behavior per PAT-011
 *   happy: close voicing span within one octave; inversions rotate bottom voices up; bass matches
 *     root (or slash bass) one octave below harmony center register
 *   error: N/A (pure functions)
 *   edges: triads + seventh chords; borrowed/secondary metadata present on progression
 *
 * Criterion 2: Minimal-movement voice leading between adjacent chords
 *   happy: I→V in C major total L1 motion ≤ 15 when previous harmony supplied (known optimal)
 *   regression: four triad chain — led motion never exceeds naive independent motion (equality until optimizer lands)
 *
 * Criterion 3: Deterministic outputs + valid MIDI ranges
 *   happy: repeated calls identical; every MIDI in 0–127
 *
 * Criterion 4–5: Regression hooks for playback + E2E covered in sibling specs
 */

import type { ChordEvent } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  bassMidiPat011,
  theoryEngine,
  voicingWithVoiceLeading,
} from '../../../../src/engine/theory';
import { chordToMidiNotes } from '../../../../src/engine/theory/chords';

function chord(overrides: Partial<ChordEvent>): ChordEvent {
  return {
    id: '30000000-0000-4000-8000-000000000001',
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

/** Pair lowest→highest voices by sorted pitch (common QA assignment for equal cardinality). */
function totalL1Sorted(prev: number[], next: number[]): number {
  const a = [...prev].sort((x, y) => x - y);
  const b = [...next].sort((x, y) => x - y);
  if (a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }
  let s = 0;
  for (let i = 0; i < a.length; i += 1) {
    s += Math.abs(a[i]! - b[i]!);
  }
  return s;
}

/** Close-position tertian chords: lowest to highest pitch class span ≤ 11 (within one octave). */
function closeVoicingSpan(midis: number[]): number {
  if (midis.length === 0) {
    return 0;
  }
  const sorted = [...midis].sort((x, y) => x - y);
  return sorted[sorted.length - 1]! - sorted[0]!;
}

describe('Harmony voicing — TASK-4.3 — PAT-011 close voicing + inversions (single chord)', () => {
  describe('happy path', () => {
    it('keeps triad chord tones within one octave in close voicing for each matrix quality at inversion 0', () => {
      const qualities: ChordEvent['quality'][] = ['major', 'minor', 'diminished'];
      for (const quality of qualities) {
        const c = chord({ scaleDegree: 5, quality, inversion: 0 });
        const v = voicingWithVoiceLeading(c, 'C', 'major', 4, null);
        expect(v.length).toBeGreaterThanOrEqual(3);
        expect(closeVoicingSpan(v)).toBeLessThanOrEqual(11);
        for (const n of v) {
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(127);
        }
      }
    });

    it('keeps seventh-chord voicing span within one octave for dom7 and inversion 3', () => {
      const c = chord({
        scaleDegree: 5,
        quality: 'major',
        seventh: 'dom7',
        inversion: 3,
      });
      const v = voicingWithVoiceLeading(c, 'C', 'major', 4, null);
      expect(v.length).toBe(4);
      expect(closeVoicingSpan(v)).toBeLessThanOrEqual(11);
    });

    it('places the lowest sounding note at the inversion bass pitch class (first inversion triad)', () => {
      const c = chord({ scaleDegree: 1, quality: 'major', inversion: 1 });
      const v = voicingWithVoiceLeading(c, 'C', 'major', 4, null);
      const sorted = [...v].sort((a, b) => a - b);
      const lowestPc = sorted[0]! % 12;
      expect(lowestPc).toBe(4);
    });
  });
});

describe('Harmony voicing — TASK-4.3 — minimal movement between chords', () => {
  describe('happy path', () => {
    it('resolves Cmaj to Gmaj with total motion ≤15 semitones when previous voicing is supplied (optimal close motion)', () => {
      const cMaj = chord({ scaleDegree: 1, quality: 'major', inversion: 0 });
      const gMaj = chord({ scaleDegree: 5, quality: 'major', inversion: 0 });
      const prev = chordToMidiNotes(cMaj, 'C', 'major', 4);
      const next = voicingWithVoiceLeading(gMaj, 'C', 'major', 4, prev);
      expect(totalL1Sorted(prev, next)).toBeLessThanOrEqual(15);
    });

    it('never exceeds independent close voicing total motion on a four-chord triad chain (regression guard once leading is smarter)', () => {
      const chords: ChordEvent[] = [
        chord({ id: '31000000-0000-4000-8000-000000000001', scaleDegree: 1, quality: 'major', seventh: 'none' }),
        chord({ id: '31000000-0000-4000-8000-000000000002', scaleDegree: 6, quality: 'minor', seventh: 'none' }),
        chord({ id: '31000000-0000-4000-8000-000000000003', scaleDegree: 4, quality: 'major', seventh: 'none' }),
        chord({ id: '31000000-0000-4000-8000-000000000004', scaleDegree: 5, quality: 'major', seventh: 'none' }),
      ];
      let prev: number[] | null = null;
      let ledMotion = 0;
      let naiveMotion = 0;
      for (let i = 0; i < chords.length; i += 1) {
        const ch = chords[i]!;
        const naive = chordToMidiNotes(ch, 'C', 'major', 4);
        const led = voicingWithVoiceLeading(ch, 'C', 'major', 4, prev);
        if (prev !== null) {
          naiveMotion += totalL1Sorted(prev, naive);
          ledMotion += totalL1Sorted(prev, led);
        }
        prev = led;
      }
      expect(ledMotion).toBeLessThanOrEqual(naiveMotion);
    });
  });
});

describe('Harmony voicing — TASK-4.3 — determinism and MIDI range', () => {
  describe('happy path', () => {
    it('returns identical MIDI arrays on repeated calls with the same arguments', () => {
      const c = chord({ scaleDegree: 2, quality: 'minor', seventh: 'min7', inversion: 2 });
      const a = voicingWithVoiceLeading(c, 'G', 'mixolydian', 3, [60, 64, 67, 71]);
      const b = voicingWithVoiceLeading(c, 'G', 'mixolydian', 3, [60, 64, 67, 71]);
      expect(a).toEqual(b);
    });

    it('returns only MIDI values in 0–127 for borrowed and secondary chord metadata', () => {
      const c = chord({
        scaleDegree: 4,
        quality: 'major',
        seventh: 'dom7',
        inversion: 2,
        borrowed: 'minor',
        secondary: { function: 'V', target: 5 },
      });
      const v = voicingWithVoiceLeading(c, 'C', 'major', 4, null);
      expect(v.length).toBeGreaterThan(0);
      for (const n of v) {
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(127);
      }
    });
  });
});

describe('Harmony voicing — TASK-4.3 — PAT-011 bass register', () => {
  describe('happy path', () => {
    it('plays C major root bass one octave below harmony center (MIDI C3 = 48 when center octave is 4)', () => {
      const c = chord({ scaleDegree: 1, quality: 'major', inversion: 0 });
      const expected = theoryEngine.scaleDegreeToMidi(1, 0, 0, 'C', 'major', 3);
      expect(bassMidiPat011(c, 'C', 'major', 4)).toBe(expected);
    });

    it('plays the slash bass pitch (B under G/B) one octave below harmony center in C major', () => {
      const gOverB = chord({ scaleDegree: 5, quality: 'major', inversion: 1 });
      const expected = theoryEngine.scaleDegreeToMidi(7, 0, 0, 'C', 'major', 3);
      expect(bassMidiPat011(gOverB, 'C', 'major', 4)).toBe(expected);
    });
  });
});
