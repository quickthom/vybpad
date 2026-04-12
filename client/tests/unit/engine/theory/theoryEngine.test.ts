/**
 * TASK-1A.7 — Contract tests for every `TheoryEngine` method in INTERFACES.md.
 * Uses the aggregated `theoryEngine` facade so coverage maps 1:1 to the interface.
 * Detailed behavior remains covered in per-module tests (PAT-014 mirrors); this file
 * adds explicit happy-path + edge coverage per method for auditability.
 */
import type { ChordEvent, ScaleDegree } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import { theoryEngine } from '../../../../src/engine/theory/theoryEngine';

const te = theoryEngine;

function chord(overrides: Partial<ChordEvent> = {}): ChordEvent {
  return {
    id: '00000000-0000-4000-8000-0000000000a7',
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

describe('TheoryEngine — INTERFACES.md contract', () => {
  describe('getScaleIntervals', () => {
    it('happy: major scale matches tertian reference', () => {
      expect(te.getScaleIntervals('major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
    });

    it('edge: returns a fresh array each call (safe to mutate)', () => {
      const a = te.getScaleIntervals('dorian');
      const b = te.getScaleIntervals('dorian');
      expect(a).not.toBe(b);
      a[0] = 99;
      expect(b[0]).toBe(0);
    });

    it('edge: harmonic minor raises the seventh degree vs natural minor', () => {
      expect(te.getScaleIntervals('harmonicMinor')[6]).toBe(11);
      expect(te.getScaleIntervals('minor')[6]).toBe(10);
    });
  });

  describe('scaleDegreeToMidi', () => {
    it('happy: scale degree 1 in C major at default base octave yields middle C', () => {
      expect(te.scaleDegreeToMidi(1, 0, 0, 'C', 'major')).toBe(60);
    });

    it('edge: clamps MIDI to 0–127 for extreme register', () => {
      expect(te.scaleDegreeToMidi(1, 20, 0, 'C', 'major', 4)).toBe(127);
      expect(te.scaleDegreeToMidi(1, -20, 0, 'C', 'major', 4)).toBe(0);
    });

    it('edge: chromatic alteration shifts pitch by semitone', () => {
      expect(te.scaleDegreeToMidi(1, 0, 1, 'C', 'major')).toBe(61);
      expect(te.scaleDegreeToMidi(1, 0, -1, 'C', 'major')).toBe(59);
    });
  });

  describe('chordToMidiNotes', () => {
    it('happy: C major triad on degree I', () => {
      const notes = te.chordToMidiNotes(chord({ scaleDegree: 1, quality: 'major' }), 'C', 'major', 4);
      expect(notes).toEqual([60, 64, 67]);
    });

    it('edge: first inversion raises the bass by an octave in close voicing', () => {
      const notes = te.chordToMidiNotes(
        chord({ scaleDegree: 1, quality: 'major', inversion: 1 }),
        'C',
        'major',
        4,
      );
      expect(notes[0]).toBeGreaterThan(60);
      expect(notes).toHaveLength(3);
    });

    it('edge: borrowed parallel minor uses borrowed mode for root spelling', () => {
      const notes = te.chordToMidiNotes(
        chord({ scaleDegree: 6, quality: 'major', borrowed: 'minor' }),
        'C',
        'major',
        4,
      );
      // ♭VI from parallel minor: A♭ major in C — root near Ab4
      expect(notes[0] % 12).toBe(8);
    });
  });

  describe('getDiatonicQuality', () => {
    it('happy: dominant triad in major is major', () => {
      expect(te.getDiatonicQuality(5, 'major')).toBe('major');
    });

    it('happy: supertonic in major is minor', () => {
      expect(te.getDiatonicQuality(2, 'major')).toBe('minor');
    });

    it('edge: leading-tone triad in major is diminished', () => {
      expect(te.getDiatonicQuality(7, 'major')).toBe('diminished');
    });
  });

  describe('getDiatonicSeventh', () => {
    it('happy: V in major carries dominant seventh quality', () => {
      expect(te.getDiatonicSeventh(5, 'major')).toBe('dom7');
    });

    it('happy: ii in major is minor seventh', () => {
      expect(te.getDiatonicSeventh(2, 'major')).toBe('min7');
    });

    it('edge: vii in major is half-diminished (min7b5)', () => {
      expect(te.getDiatonicSeventh(7, 'major')).toBe('min7b5');
    });
  });

  describe('toRomanNumeral', () => {
    it('happy: subdominant in major is IV', () => {
      expect(te.toRomanNumeral(chord({ scaleDegree: 4, quality: 'major' }), 'major')).toBe('IV');
    });

    it('edge: secondary dominant (V of V) uses slash notation', () => {
      expect(
        te.toRomanNumeral(
          chord({
            scaleDegree: 2,
            quality: 'major',
            secondary: { function: 'V', target: 5 },
          }),
          'major',
        ),
      ).toBe('V/V');
    });

    it('edge: diminished triad uses degree sign', () => {
      expect(te.toRomanNumeral(chord({ scaleDegree: 7, quality: 'diminished' }), 'major')).toContain('°');
    });
  });

  describe('toChordName', () => {
    it('happy: C major triad spelled as C in C major', () => {
      expect(te.toChordName(chord({ scaleDegree: 1, quality: 'major' }), 'C', 'major')).toMatch(/^C(?!#)/);
    });

    it('happy: D minor includes minor quality in symbol', () => {
      expect(te.toChordName(chord({ scaleDegree: 2, quality: 'minor' }), 'C', 'major')).toMatch(/^Dm/);
    });

    it('edge: first inversion adds slash bass when bass differs from root', () => {
      const name = te.toChordName(
        chord({ scaleDegree: 1, quality: 'major', inversion: 1 }),
        'C',
        'major',
      );
      expect(name).toContain('/');
    });
  });

  describe('getChordTones', () => {
    it('happy: major triad maps to three scale degrees', () => {
      expect(te.getChordTones(chord({ scaleDegree: 1, quality: 'major' }), 'major')).toEqual([1, 3, 5]);
    });

    it('edge: dominant seventh includes four degrees', () => {
      const degrees = te.getChordTones(
        chord({ scaleDegree: 5, quality: 'major', seventh: 'dom7' }),
        'major',
      );
      expect(degrees).toHaveLength(4);
      expect(degrees.sort((a, b) => a - b)).toEqual([2, 4, 5, 7]);
    });

    it('edge: iv from parallel minor maps chord tones to home degrees (Fm in C → 1, 4, 6)', () => {
      const degrees = sortDeg(
        te.getChordTones(chord({ scaleDegree: 4, quality: 'minor', borrowed: 'minor' }), 'major'),
      );
      expect(degrees).toEqual([1, 4, 6]);
    });
  });

  describe('getGuideCompatibility', () => {
    const cMajorI = chord({ scaleDegree: 1, quality: 'major' });

    it('happy: chord tone classifies as chord-tone', () => {
      expect(te.getGuideCompatibility(1, 0, cMajorI, 'major')).toBe('chord-tone');
    });

    it('happy: diatonic non-chord pitch classifies as scale-tone', () => {
      expect(te.getGuideCompatibility(2 as ScaleDegree, 0, cMajorI, 'major')).toBe('scale-tone');
    });

    it('edge: chromatic alteration outside scale and chord is chromatic', () => {
      expect(te.getGuideCompatibility(1, 1, cMajorI, 'major')).toBe('chromatic');
    });
  });
});

function sortDeg(d: ScaleDegree[]): ScaleDegree[] {
  return [...d].sort((a, b) => a - b);
}
