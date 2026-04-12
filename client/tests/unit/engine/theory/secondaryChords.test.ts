/*
 * QA COVERAGE PLAN — TASK-1A.5
 *
 * Criterion 1: resolveSecondaryTarget(secondary, key, scale) — local tonic key + scale for secondary
 *   happy: V/V, V/ii, V/vi in C major per brief
 *   error: N/A (pure helper)
 *   edges: V/V in a natural minor key
 *
 * Criterion 2: getSecondaryChordMidi(secondary, chord, key, scale) — MIDI for applied chords
 *   happy: V/V in C major → D major triad [62, 66, 69]
 *
 * Criterion 3: getAvailableSecondaryChords(scale) — palette minus diatonic duplicates / invalid targets
 *   happy: major includes V/ii–V/vi with V, excludes V/I and V/viio
 *   edges: minor scale yields a non-empty valid list using SecondaryChord from shared
 *
 * Criterion 4: Purity for all exports
 *
 * Criterion 5: Types — SecondaryChord, ChordEvent, NoteName, ScaleType, ChordQuality from @vybpad/shared
 */

import type { ChordEvent, NoteName, ScaleType, SecondaryChord } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';
import {
  getAvailableSecondaryChords,
  getSecondaryChordMidi,
  resolveSecondaryTarget,
} from '../../../../src/engine/theory/secondaryChords';

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

function sortSecondaryChords(list: SecondaryChord[]): SecondaryChord[] {
  return [...list].sort((a, b) => {
    if (a.function !== b.function) {
      return a.function.localeCompare(b.function);
    }
    return a.target - b.target;
  });
}

describe('secondary targets — TASK-1A.5 — resolveSecondaryTarget in C major', () => {
  describe('happy path', () => {
    it('returns targetKey G and targetScale major for V/V (dominant of the dominant)', () => {
      const s: SecondaryChord = { function: 'V', target: 5 };
      expect(resolveSecondaryTarget(s, 'C', 'major')).toEqual({
        targetKey: 'G',
        targetScale: 'major',
      });
    });

    it('returns targetKey D and targetScale minor for V/ii (dominant of the supertonic minor)', () => {
      const s: SecondaryChord = { function: 'V', target: 2 };
      expect(resolveSecondaryTarget(s, 'C', 'major')).toEqual({
        targetKey: 'D',
        targetScale: 'minor',
      });
    });

    it('returns targetKey A and targetScale minor for V/vi (dominant of the submediant minor)', () => {
      const s: SecondaryChord = { function: 'V', target: 6 };
      expect(resolveSecondaryTarget(s, 'C', 'major')).toEqual({
        targetKey: 'A',
        targetScale: 'minor',
      });
    });
  });
});

describe('secondary targets — TASK-1A.5 — resolveSecondaryTarget in a minor key', () => {
  describe('edge cases', () => {
    it('returns targetKey E and targetScale minor for V/V in A natural minor (dominant of the dominant)', () => {
      const s: SecondaryChord = { function: 'V', target: 5 };
      expect(resolveSecondaryTarget(s, 'A', 'minor')).toEqual({
        targetKey: 'E',
        targetScale: 'minor',
      });
    });
  });
});

describe('secondary MIDI — TASK-1A.5 — getSecondaryChordMidi', () => {
  describe('happy path', () => {
    it('returns D major triad MIDI 62, 66, 69 for V/V in C major with an explicit major secondary dominant chord event', () => {
      const secondary: SecondaryChord = { function: 'V', target: 5 };
      const c = chord({
        scaleDegree: 2,
        quality: 'major',
        secondary,
      });
      const notes = getSecondaryChordMidi(secondary, c, 'C', 'major');
      expect(notes).toEqual([62, 66, 69]);
    });
  });
});

describe('secondary palette — TASK-1A.5 — getAvailableSecondaryChords', () => {
  describe('happy path', () => {
    it('for major scale lists V/ii, V/iii, V/IV, V/V, and V/vi with function V and excludes V/I and V/viio', () => {
      const available = getAvailableSecondaryChords('major');
      const onlyV = available.filter((x) => x.function === 'V');
      const targets = onlyV.map((x) => x.target).sort((a, b) => a - b);
      expect(targets).toEqual([2, 3, 4, 5, 6]);
      expect(onlyV.some((x) => x.target === 1)).toBe(false);
      expect(onlyV.some((x) => x.target === 7)).toBe(false);
    });

    it('does not list a secondary that is identical to the diatonic chord of the same Roman function', () => {
      const available = sortSecondaryChords(getAvailableSecondaryChords('major'));
      expect(available.some((x) => x.function === 'V' && x.target === 1)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns at least one valid SecondaryChord for natural minor and only uses shared SecondaryFunction values', () => {
      const available = getAvailableSecondaryChords('minor');
      expect(available.length).toBeGreaterThan(0);
      for (const item of available) {
        expect(['V', 'viio', 'IV']).toContain(item.function);
        expect(item.target).toBeGreaterThanOrEqual(1);
        expect(item.target).toBeLessThanOrEqual(7);
      }
    });
  });
});

describe('secondary helpers — TASK-1A.5 — purity', () => {
  describe('happy path', () => {
    it('returns identical results when resolveSecondaryTarget is called twice with the same arguments', () => {
      const s: SecondaryChord = { function: 'V', target: 4 };
      const a = resolveSecondaryTarget(s, 'F' as NoteName, 'major');
      const b = resolveSecondaryTarget(s, 'F' as NoteName, 'major');
      expect(a).toEqual(b);
    });

    it('returns identical MIDI arrays when getSecondaryChordMidi is called twice with the same arguments', () => {
      const secondary: SecondaryChord = { function: 'V', target: 5 };
      const c = chord({ scaleDegree: 2, quality: 'major', secondary });
      const x = getSecondaryChordMidi(secondary, c, 'C', 'major');
      const y = getSecondaryChordMidi(secondary, c, 'C', 'major');
      expect(x).toEqual(y);
    });

    it('returns identical palette arrays when getAvailableSecondaryChords is called twice', () => {
      const s: ScaleType = 'mixolydian';
      expect(getAvailableSecondaryChords(s)).toEqual(getAvailableSecondaryChords(s));
    });
  });
});
