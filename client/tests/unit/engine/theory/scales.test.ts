/*
 * QA COVERAGE PLAN — TASK-1A.1 + TASK-1A.2 (scale intervals subset)
 *
 * Criterion 1: getScaleIntervals returns correct 7-element intervals for all 9 scales
 *   happy: each ScaleType maps to expected semitone array from tonic
 *   error: N/A (API always returns number[] for valid ScaleType)
 *   edges: length 7, first element 0
 *
 * Criterion 2: all interval arrays start with 0
 *   happy: first element === 0 for every scale
 *
 * Criterion 3: exactly 7 elements
 *   happy: length === 7 for every scale
 *
 * Criterion 4: known reference values for listed scales
 *   happy: exact array equality for specified scales
 *
 * Criterion 5: new array each call (mutation safety)
 *   happy: consecutive calls return different array references; mutating one does not affect the next
 *
 * Criterion 6: pure function, no side effects
 *   happy: repeated calls with same input yield deep-equal results
 */
import type { ScaleType } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import { getScaleIntervals } from '../../../../src/engine/theory/scales';

const ALL_SCALES: ScaleType[] = [
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

/** Canonical interval sets — contract for TASK-1A.1 */
const EXPECTED_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
};

describe('getScaleIntervals — TASK-1A.1 interval definitions', () => {
  describe('happy path', () => {
    it('returns the canonical 7-semitone-interval set for each of the nine ScaleType values', () => {
      for (const scale of ALL_SCALES) {
        expect(getScaleIntervals(scale)).toEqual(EXPECTED_INTERVALS[scale]);
      }
    });

    it('returns arrays whose first element is 0 (tonic) for every scale', () => {
      for (const scale of ALL_SCALES) {
        expect(getScaleIntervals(scale)[0]).toBe(0);
      }
    });

    it('returns arrays of length 7 for every scale', () => {
      for (const scale of ALL_SCALES) {
        expect(getScaleIntervals(scale)).toHaveLength(7);
      }
    });

    it('matches known reference values for major, minor, dorian, lydian, harmonicMinor, and phrygianDominant', () => {
      expect(getScaleIntervals('major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
      expect(getScaleIntervals('minor')).toEqual([0, 2, 3, 5, 7, 8, 10]);
      expect(getScaleIntervals('dorian')).toEqual([0, 2, 3, 5, 7, 9, 10]);
      expect(getScaleIntervals('lydian')).toEqual([0, 2, 4, 6, 7, 9, 11]);
      expect(getScaleIntervals('harmonicMinor')).toEqual([0, 2, 3, 5, 7, 8, 11]);
      expect(getScaleIntervals('phrygianDominant')).toEqual([0, 1, 4, 5, 7, 8, 10]);
    });
  });

  describe('mutation safety', () => {
    it('returns a new array instance on each call so mutating one result does not affect the next', () => {
      const first = getScaleIntervals('major');
      const second = getScaleIntervals('major');
      expect(first).not.toBe(second);
      first[0] = 99;
      expect(getScaleIntervals('major')[0]).toBe(0);
      expect(second[0]).toBe(0);
    });
  });

  describe('pure function behavior', () => {
    it('returns deeply equal results for repeated calls with the same scale', () => {
      const a = getScaleIntervals('mixolydian');
      const b = getScaleIntervals('mixolydian');
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });
});
