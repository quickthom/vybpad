/*
 * QA COVERAGE PLAN — TASK-1A.2 (noteNameToMidiBase)
 *
 * Criterion 9: noteNameToMidiBase returns pitch class C=0 … B=11 for all 12 names
 *   happy: each NoteName maps to expected integer 0–11
 *   error: N/A (typed API)
 *   edges: none beyond the twelve chromatic pitch classes
 *
 * Criterion 10 (shared): pure function — repeated calls stable
 */
import { describe, expect, it } from 'vitest';

import { noteNameToMidiBase } from '../../../../src/engine/theory/noteNames';

describe('noteNameToMidiBase — TASK-1A.2 pitch-class mapping', () => {
  describe('happy path', () => {
    it('returns pitch classes 0 through 11 for the twelve chromatic note names', () => {
      expect(noteNameToMidiBase('C')).toBe(0);
      expect(noteNameToMidiBase('C#')).toBe(1);
      expect(noteNameToMidiBase('D')).toBe(2);
      expect(noteNameToMidiBase('D#')).toBe(3);
      expect(noteNameToMidiBase('E')).toBe(4);
      expect(noteNameToMidiBase('F')).toBe(5);
      expect(noteNameToMidiBase('F#')).toBe(6);
      expect(noteNameToMidiBase('G')).toBe(7);
      expect(noteNameToMidiBase('G#')).toBe(8);
      expect(noteNameToMidiBase('A')).toBe(9);
      expect(noteNameToMidiBase('A#')).toBe(10);
      expect(noteNameToMidiBase('B')).toBe(11);
    });
  });

  describe('pure function behavior', () => {
    it('returns the same pitch class on every call for a given note name', () => {
      expect(noteNameToMidiBase('F#')).toBe(6);
      expect(noteNameToMidiBase('F#')).toBe(6);
    });
  });
});
