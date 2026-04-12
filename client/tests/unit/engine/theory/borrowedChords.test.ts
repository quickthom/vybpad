/*
 * QA COVERAGE PLAN — TASK-1A.5
 *
 * Criterion 1: getBorrowedChords(homeScale, borrowedScale) returns per-degree info
 *   happy: parallel major↔minor, major↔dorian, major↔harmonicMinor show expected rootAltered flags
 *   error: N/A (pure function; no API error contract in INTERFACES for this helper)
 *   edges: degrees where tonic pitch matches (e.g. iv vs IV) keep rootAltered false
 *
 * Criterion 2: Purity — repeated calls yield deep-equal results
 *
 * Criterion 3: Types — ScaleType from @vybpad/shared only; return shapes are plain data
 */

import type { ScaleDegree, ScaleType } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';
import { getBorrowedChords } from '../../../../src/engine/theory/borrowedChords';

/** Narrow helper: each entry describes one borrowable scale degree. */
function degreeInfo(
  rows: { scaleDegree: ScaleDegree; rootAltered: boolean }[],
  degree: ScaleDegree,
): { scaleDegree: ScaleDegree; rootAltered: boolean } | undefined {
  return rows.find((r) => r.scaleDegree === degree);
}

describe('borrowed chord palette — TASK-1A.5 — getBorrowedChords major to parallel minor', () => {
  describe('happy path', () => {
    it('marks bIII, bVI, and bVII scale degrees as rootAltered (3, 6, 7) when borrowing from minor into major', () => {
      const rows = getBorrowedChords('major', 'minor');
      expect(degreeInfo(rows, 3)?.rootAltered).toBe(true);
      expect(degreeInfo(rows, 6)?.rootAltered).toBe(true);
      expect(degreeInfo(rows, 7)?.rootAltered).toBe(true);
    });

    it('keeps rootAltered false for degree 4 where the borrowed minor scale shares the same root pitch as major (iv vs IV)', () => {
      const rows = getBorrowedChords('major', 'minor');
      expect(degreeInfo(rows, 4)?.rootAltered).toBe(false);
    });

    it('includes borrowed options for the parallel minor palette including degree 4 (iv quality change)', () => {
      const rows = getBorrowedChords('major', 'minor');
      const degrees = rows.map((r) => r.scaleDegree).sort((a, b) => a - b);
      expect(degrees).toEqual(expect.arrayContaining([3, 4, 6, 7]));
    });
  });
});

describe('borrowed chord palette — TASK-1A.5 — getBorrowedChords major to dorian', () => {
  describe('happy path', () => {
    it('marks degrees whose Dorian pitch class differs from major (e.g. lowered 3 and lowered 7 in Dorian vs Ionian)', () => {
      const rows = getBorrowedChords('major', 'dorian');
      expect(degreeInfo(rows, 3)?.rootAltered).toBe(true);
      expect(degreeInfo(rows, 7)?.rootAltered).toBe(true);
    });

    it('does not mark degree 6 as rootAltered when major and Dorian share the same sixth scale degree', () => {
      const rows = getBorrowedChords('major', 'dorian');
      expect(degreeInfo(rows, 6)?.rootAltered).toBe(false);
    });
  });
});

describe('borrowed chord palette — TASK-1A.5 — getBorrowedChords minor to parallel major', () => {
  describe('happy path', () => {
    it('marks raised mediant, submediant, and leading tone degrees as rootAltered when borrowing from major into natural minor', () => {
      const rows = getBorrowedChords('minor', 'major');
      expect(degreeInfo(rows, 3)?.rootAltered).toBe(true);
      expect(degreeInfo(rows, 6)?.rootAltered).toBe(true);
      expect(degreeInfo(rows, 7)?.rootAltered).toBe(true);
    });
  });
});

describe('borrowed chord palette — TASK-1A.5 — getBorrowedChords major to harmonic minor', () => {
  describe('edge cases', () => {
    it('reflects pitch differences between Ionian and harmonic minor (e.g. lowered third and sixth)', () => {
      const rows = getBorrowedChords('major', 'harmonicMinor');
      expect(degreeInfo(rows, 3)?.rootAltered).toBe(true);
      expect(degreeInfo(rows, 6)?.rootAltered).toBe(true);
    });
  });
});

describe('borrowed chord palette — TASK-1A.5 — purity', () => {
  describe('happy path', () => {
    it('returns deep-equal results when getBorrowedChords is called twice with the same scale pair', () => {
      const a = getBorrowedChords('major', 'minor');
      const b = getBorrowedChords('major', 'minor');
      expect(a).toEqual(b);
    });
  });
});
