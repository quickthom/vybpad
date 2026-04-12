/*
 * QA COVERAGE PLAN — TASK-1A.2 (scaleDegreeToMidi)
 *
 * Criterion 1: middle C for C major degree 1
 * Criterion 2: tonic MIDI in D major and A major
 * Criterion 3: octave offset ±1
 * Criterion 4: chromatic offset ±1
 * Criterion 5: diatonic degrees 3, 5, 7 in C major
 * Criterion 6: C minor degree 3; C harmonic minor degree 7
 * Criterion 7: MIDI clamped to 0–127
 * Criterion 8: baseOctave parameter (e.g. 3 → degree 1 = 48 for C major)
 * Criterion 10: pure function — deterministic, no observable side effects across calls
 */
import { describe, expect, it } from 'vitest';

import { scaleDegreeToMidi } from '../../../../src/engine/theory/scaleDegreeToMidi';

describe('scaleDegreeToMidi — TASK-1A.2 degree to MIDI conversion', () => {
  describe('happy path', () => {
    it('returns MIDI 60 for scale degree 1 in C major at octave 0, chromatic 0, default base octave', () => {
      expect(scaleDegreeToMidi(1, 0, 0, 'C', 'major')).toBe(60);
    });

    it('returns MIDI 62 for scale degree 1 in D major and 69 for scale degree 1 in A major', () => {
      expect(scaleDegreeToMidi(1, 0, 0, 'D', 'major')).toBe(62);
      expect(scaleDegreeToMidi(1, 0, 0, 'A', 'major')).toBe(69);
    });

    it('applies relative octave offset so degree 1 in C major is 72 at +1 and 48 at -1', () => {
      expect(scaleDegreeToMidi(1, 1, 0, 'C', 'major')).toBe(72);
      expect(scaleDegreeToMidi(1, -1, 0, 'C', 'major')).toBe(48);
    });

    it('applies chromatic offset so degree 1 in C major is 61 at +1 semitone and 59 at -1', () => {
      expect(scaleDegreeToMidi(1, 0, 1, 'C', 'major')).toBe(61);
      expect(scaleDegreeToMidi(1, 0, -1, 'C', 'major')).toBe(59);
    });

    it('maps scale degrees 3, 5, and 7 in C major to E4, G4, and B4 (64, 67, 71)', () => {
      expect(scaleDegreeToMidi(3, 0, 0, 'C', 'major')).toBe(64);
      expect(scaleDegreeToMidi(5, 0, 0, 'C', 'major')).toBe(67);
      expect(scaleDegreeToMidi(7, 0, 0, 'C', 'major')).toBe(71);
    });

    it('maps degree 3 in C natural minor to Eb (63) and degree 7 in C harmonic minor to B (71)', () => {
      expect(scaleDegreeToMidi(3, 0, 0, 'C', 'minor')).toBe(63);
      expect(scaleDegreeToMidi(7, 0, 0, 'C', 'harmonicMinor')).toBe(71);
    });

    it('anchors degree 1 in C major to MIDI 48 when baseOctave is 3', () => {
      expect(scaleDegreeToMidi(1, 0, 0, 'C', 'major', 3)).toBe(48);
    });
  });

  describe('MIDI range clamping', () => {
    it('returns a value in 0–127 inclusive for extreme octave offsets', () => {
      const veryLow = scaleDegreeToMidi(1, -20, 0, 'C', 'major');
      const veryHigh = scaleDegreeToMidi(1, 20, 0, 'C', 'major');
      expect(veryLow).toBeGreaterThanOrEqual(0);
      expect(veryLow).toBeLessThanOrEqual(127);
      expect(veryHigh).toBeGreaterThanOrEqual(0);
      expect(veryHigh).toBeLessThanOrEqual(127);
    });

    it('clamps computed values below 0 to 0 and above 127 to 127', () => {
      expect(scaleDegreeToMidi(1, -10, 0, 'C', 'major')).toBe(0);
      expect(scaleDegreeToMidi(7, 10, 0, 'C', 'major')).toBe(127);
    });
  });

  describe('pure function behavior', () => {
    it('returns the same MIDI number for repeated calls with identical arguments', () => {
      const args = [3, -1, 2, 'G', 'dorian', 4] as const;
      expect(scaleDegreeToMidi(...args)).toBe(scaleDegreeToMidi(...args));
    });
  });
});
