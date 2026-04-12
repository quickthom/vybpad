/*
 * QA COVERAGE PLAN — TASK-1A.7
 *
 * Criterion 1: Coverage map — each TheoryEngine method from INTERFACES.md is exercised
 *   happy: single composed `theoryEngine` object (type-checked against the contract) invokes
 *     getScaleIntervals, scaleDegreeToMidi, chordToMidiNotes, getDiatonicQuality, getDiatonicSeventh,
 *     toRomanNumeral, toChordName, getChordTones, getGuideCompatibility
 *   error: N/A (pure functions; no shared API error shape for theory)
 *   edges: all nine ScaleType values on interval + diatonic helpers; borrowed chord in integration path;
 *     secondary chord in Roman/name path; inversion 0 for MIDI vs scale-degree alignment
 *
 * AUTHORITATIVE vs THIS SUITE (gap analysis vs TASK-1A.1–1A.6):
 * - scales.test.ts — authoritative for getScaleIntervals: all ScaleType rows, mutation safety, purity
 * - scaleDegreeToMidi.test.ts — authoritative for scaleDegreeToMidi: octaves, chromatic, clamping, baseOctave
 * - chords.test.ts — authoritative for chordToMidiNotes, getDiatonicQuality, getDiatonicSeventh:
 *   voicings, inversions, sus/add, sevenths, borrowed spelling
 * - romanNumerals.test.ts — authoritative for toRomanNumeral / toChordName: diatonic tables, sevenths,
 *   sus/add, figured bass, borrowed, secondary
 * - guideTones.test.ts — authoritative for getChordTones / getGuideCompatibility: tone sets, borrowed,
 *   scale sweep
 * - borrowedChords.test.ts & secondaryChords.test.ts — palette helpers outside the TheoryEngine interface
 * - THIS FILE — adds: (a) explicit TheoryEngine-shaped aggregate (INTERFACES.md) for CI/coverage mapping,
 *   (b) cross-method consistency (root MIDI vs scale degree, chord-tone degrees vs guide classification),
 *   (c) one integration scenario touching all nine methods in one flow. When `theoryEngine.ts` lands on the
 *   branch, switch the import to `theoryEngine` from that module so tests exercise the same object app
 *   code will use.
 */

import type {
  ChordEvent,
  ChordQuality,
  NoteName,
  ScaleDegree,
  ScaleType,
  SeventhType,
} from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  chordToMidiNotes,
  getDiatonicQuality,
  getDiatonicSeventh,
} from '../../../../src/engine/theory/chords';
import { getChordTones, getGuideCompatibility } from '../../../../src/engine/theory/guideTones';
import { toChordName, toRomanNumeral } from '../../../../src/engine/theory/romanNumerals';
import { scaleDegreeToMidi } from '../../../../src/engine/theory/scaleDegreeToMidi';
import { getScaleIntervals } from '../../../../src/engine/theory/scales';

/** Mirrors INTERFACES.md — Music Theory Engine Interface (compile-time contract for the composed engine). */
interface TheoryEngine {
  getScaleIntervals(scale: ScaleType): number[];
  scaleDegreeToMidi(
    degree: ScaleDegree,
    octave: number,
    chromatic: number,
    key: NoteName,
    scale: ScaleType,
    baseOctave?: number,
  ): number;
  chordToMidiNotes(
    chord: ChordEvent,
    key: NoteName,
    scale: ScaleType,
    voicingOctave?: number,
  ): number[];
  getDiatonicQuality(degree: ScaleDegree, scale: ScaleType): ChordQuality;
  getDiatonicSeventh(degree: ScaleDegree, scale: ScaleType): SeventhType;
  toRomanNumeral(chord: ChordEvent, scale: ScaleType): string;
  toChordName(chord: ChordEvent, key: NoteName, scale: ScaleType): string;
  getChordTones(chord: ChordEvent, scale: ScaleType): ScaleDegree[];
  getGuideCompatibility(
    degree: ScaleDegree,
    chromatic: number,
    chord: ChordEvent,
    scale: ScaleType,
  ): 'chord-tone' | 'scale-tone' | 'chromatic';
}

const theoryEngine: TheoryEngine = {
  getScaleIntervals,
  scaleDegreeToMidi,
  chordToMidiNotes,
  getDiatonicQuality,
  getDiatonicSeventh,
  toRomanNumeral,
  toChordName,
  getChordTones,
  getGuideCompatibility,
};

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

function makeChord(overrides: Partial<ChordEvent> = {}): ChordEvent {
  return {
    id: '00000000-0000-4000-8000-000000000099',
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

describe('TheoryEngine — TASK-1A.7 — coverage map (all nine methods)', () => {
  describe('happy path', () => {
    it('exposes nine callable methods matching the INTERFACES.md TheoryEngine surface', () => {
      expect(typeof theoryEngine.getScaleIntervals).toBe('function');
      expect(typeof theoryEngine.scaleDegreeToMidi).toBe('function');
      expect(typeof theoryEngine.chordToMidiNotes).toBe('function');
      expect(typeof theoryEngine.getDiatonicQuality).toBe('function');
      expect(typeof theoryEngine.getDiatonicSeventh).toBe('function');
      expect(typeof theoryEngine.toRomanNumeral).toBe('function');
      expect(typeof theoryEngine.toChordName).toBe('function');
      expect(typeof theoryEngine.getChordTones).toBe('function');
      expect(typeof theoryEngine.getGuideCompatibility).toBe('function');
    });

    it('invokes getScaleIntervals for each ScaleType and yields length-7 arrays starting at 0', () => {
      for (const scale of ALL_SCALES) {
        const intervals = theoryEngine.getScaleIntervals(scale);
        expect(intervals).toHaveLength(7);
        expect(intervals[0]).toBe(0);
      }
    });

    it('invokes getDiatonicQuality and getDiatonicSeventh for degree 1 across all nine scales', () => {
      for (const scale of ALL_SCALES) {
        expect(theoryEngine.getDiatonicQuality(1, scale)).toMatch(/major|minor|diminished|augmented/);
        expect(theoryEngine.getDiatonicSeventh(1, scale)).toMatch(
          /none|maj7|min7|dom7|dim7|min7b5/,
        );
      }
    });

    it('invokes scaleDegreeToMidi with default and explicit baseOctave for C major degree 1', () => {
      expect(theoryEngine.scaleDegreeToMidi(1, 0, 0, 'C', 'major')).toBe(60);
      expect(theoryEngine.scaleDegreeToMidi(1, 0, 0, 'C', 'major', 3)).toBe(48);
    });

    it('invokes chordToMidiNotes for a C major triad on degree 1 at octave 4', () => {
      const c = makeChord({ scaleDegree: 1, quality: 'major' });
      expect(theoryEngine.chordToMidiNotes(c, 'C', 'major', 4)).toEqual([60, 64, 67]);
    });

    it('invokes toRomanNumeral and toChordName for the same diatonic I chord in C major', () => {
      const c = makeChord({ scaleDegree: 1, quality: 'major' });
      expect(theoryEngine.toRomanNumeral(c, 'major')).toBe('I');
      expect(theoryEngine.toChordName(c, 'C', 'major')).toMatch(/^C(maj|$)/);
    });

    it('invokes getChordTones and getGuideCompatibility for I major in C major', () => {
      const c = makeChord({ scaleDegree: 1, quality: 'major' });
      expect(theoryEngine.getChordTones(c, 'major')).toEqual([1, 3, 5]);
      expect(theoryEngine.getGuideCompatibility(3, 0, c, 'major')).toBe('chord-tone');
      expect(theoryEngine.getGuideCompatibility(2, 0, c, 'major')).toBe('scale-tone');
    });
  });
});

describe('TheoryEngine — TASK-1A.7 — cross-contract consistency', () => {
  describe('happy path', () => {
    it('aligns root-position lowest MIDI pitch class with scaleDegreeToMidi for the chord root degree (diatonic triad, inversion 0)', () => {
      const key: NoteName = 'G';
      const scale: ScaleType = 'major';
      const chord = makeChord({ scaleDegree: 4, quality: 'major', inversion: 0 });
      const midis = theoryEngine.chordToMidiNotes(chord, key, scale, 4);
      const lowest = Math.min(...midis);
      const rootMidi = theoryEngine.scaleDegreeToMidi(4, 0, 0, key, scale, 4);
      expect(lowest % 12).toBe(rootMidi % 12);
    });

    it('classifies every getChordTones output degree as chord-tone for chromatic offset 0 on a V7 in C major', () => {
      const chord = makeChord({
        scaleDegree: 5,
        quality: 'major',
        seventh: 'dom7',
        inversion: 0,
      });
      const tones = theoryEngine.getChordTones(chord, 'major');
      for (const d of tones) {
        expect(theoryEngine.getGuideCompatibility(d, 0, chord, 'major')).toBe('chord-tone');
      }
    });

    it('uses getDiatonicQuality and getDiatonicSeventh in the same scale as labels for a V7 Roman numeral in C major', () => {
      const chord = makeChord({
        scaleDegree: 5,
        quality: theoryEngine.getDiatonicQuality(5, 'major'),
        seventh: theoryEngine.getDiatonicSeventh(5, 'major'),
      });
      expect(theoryEngine.toRomanNumeral(chord, 'major')).toMatch(/^V7/);
    });
  });
});

describe('TheoryEngine — TASK-1A.7 — integration scenario (all methods)', () => {
  describe('happy path', () => {
    it('runs key F major, ii7 borrowed-none: intervals, diatonic helpers, MIDI, names, tones, and guide class in one flow', () => {
      const key: NoteName = 'F';
      const scale: ScaleType = 'major';

      const intervals = theoryEngine.getScaleIntervals(scale);
      expect(intervals[1]).toBe(2);

      const deg2Quality = theoryEngine.getDiatonicQuality(2, scale);
      const deg2Seventh = theoryEngine.getDiatonicSeventh(2, scale);
      expect(deg2Quality).toBe('minor');
      expect(deg2Seventh).toBe('min7');

      const gm7 = makeChord({
        scaleDegree: 2,
        quality: deg2Quality,
        seventh: deg2Seventh,
        inversion: 0,
      });

      const melodyMid = theoryEngine.scaleDegreeToMidi(2, 0, 0, key, scale, 4);
      expect(melodyMid).toBeGreaterThan(0);

      const voicing = theoryEngine.chordToMidiNotes(gm7, key, scale, 4);
      expect(voicing.length).toBeGreaterThanOrEqual(3);

      expect(theoryEngine.toRomanNumeral(gm7, scale)).toContain('ii');
      expect(theoryEngine.toChordName(gm7, key, scale)).toMatch(/^Gm/);

      const tones = theoryEngine.getChordTones(gm7, scale);
      expect(tones.length).toBeGreaterThanOrEqual(3);
      expect(theoryEngine.getGuideCompatibility(2, 0, gm7, scale)).toBe('chord-tone');
    });
  });
});

describe('TheoryEngine — TASK-1A.7 — borrowed and secondary paths on the composed surface', () => {
  describe('happy path', () => {
    it('exercises chordToMidiNotes, toRomanNumeral, toChordName, getChordTones, and getGuideCompatibility for a borrowed iv in C major', () => {
      const chord = makeChord({
        scaleDegree: 4,
        quality: 'minor',
        borrowed: 'minor',
        inversion: 0,
      });
      theoryEngine.chordToMidiNotes(chord, 'C', 'major', 4);
      expect(theoryEngine.toRomanNumeral(chord, 'major')).toContain('iv');
      expect(theoryEngine.toChordName(chord, 'C', 'major')).toMatch(/^F/);
      expect(theoryEngine.getChordTones(chord, 'major').length).toBeGreaterThanOrEqual(3);
      expect(theoryEngine.getGuideCompatibility(4, 0, chord, 'major')).toBe('chord-tone');
    });

    it('exercises toRomanNumeral with secondary metadata (V/V) and chordToMidiNotes', () => {
      const chord = makeChord({
        scaleDegree: 5,
        quality: 'major',
        secondary: { function: 'V', target: 5 },
        inversion: 0,
      });
      expect(theoryEngine.toRomanNumeral(chord, 'major')).toContain('V');
      expect(theoryEngine.chordToMidiNotes(chord, 'C', 'major', 4).length).toBeGreaterThanOrEqual(3);
    });
  });
});
