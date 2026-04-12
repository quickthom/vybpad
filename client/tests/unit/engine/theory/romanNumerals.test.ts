/*
 * QA COVERAGE PLAN — TASK-1A.4
 *
 * Criterion 1: toRomanNumeral — diatonic triads, all nine scales; case rules (maj/aug uppercase, min/dim lowercase + °)
 *   happy: each degree 1–7 with getDiatonicQuality(deg, scale) matches canonical Roman triad label per scale
 *   error: N/A (no error contract in INTERFACES for invalid input)
 *   edges: none beyond full scale sweep
 *
 * Criterion 2: seventh suffixes (maj7, dom7, min7, dim7, min7b5)
 *   happy: IVmaj7, V7, ii7, viio7, viiø7 style strings per INTERFACES examples
 *   error: N/A
 *   edges: harmonic minor i with maj7 seventh type (minor-major seventh chord)
 *
 * Criterion 3: suspension and addition suffixes
 *   happy: Vsus4, Isus2, Iadd9, IVadd11 (representative)
 *   error: N/A
 *
 * Criterion 4: inversion notation on Roman labels
 *   happy: triad I6 / I64; seventh V65 / V43 / V42 (figured-bass style, ASCII)
 *   error: N/A
 *
 * Criterion 5: borrowed chords (e.g. bVII from parallel minor in major)
 *   happy: bVII for flat-seven major triad borrowed from parallel minor
 *   error: N/A
 *
 * Criterion 6: secondary / applied chords (V/x, viio/x)
 *   happy: V/V; viio/V or viio/vi per SecondaryChord metadata
 *   error: N/A
 *
 * Criterion 7–8: toChordName — absolute names and slash bass for inversions
 *   happy: C, Dm, G7, Fmaj7 in C major; C/E, G7/B; borrowed bVII → Bb
 *   error: N/A
 *
 * Criterion 9: pure functions — no input mutation; stable outputs
 *   happy: repeated calls equal; chord object unchanged after call
 *   error: N/A
 */

import type { ChordEvent, ScaleDegree, ScaleType } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';
import { getDiatonicQuality } from '../../../../src/engine/theory/chords';
import { toChordName, toRomanNumeral } from '../../../../src/engine/theory/romanNumerals';

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

/**
 * Canonical diatonic triad Roman numerals (degrees 1–7) for each supported scale.
 * Uppercase = major or augmented; lowercase = minor or diminished (° for diminished triads).
 */
const DIATONIC_TRIADS: Record<ScaleType, readonly string[]> = {
  major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  minor: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
  dorian: ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII'],
  phrygian: ['i', 'II', 'III', 'iv', 'v°', 'VI', 'vii'],
  lydian: ['I', 'II', 'iii', '#iv°', 'V', 'vi', 'vii'],
  mixolydian: ['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'VII'],
  locrian: ['i°', 'II', 'iii', 'iv', 'V', 'VI', 'vii'],
  harmonicMinor: ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°'],
  phrygianDominant: ['I', 'II', 'iii°', 'iv', 'v°', 'VI+', 'vii'],
};

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

describe('toRomanNumeral — TASK-1A.4 — diatonic triads across all scales', () => {
  describe('happy path', () => {
    it('returns the canonical Roman triad for each scale degree 1–7 when quality matches the diatonic triad quality for that scale', () => {
      for (const scale of ALL_SCALES) {
        const expectedRow = DIATONIC_TRIADS[scale];
        for (let d = 1; d <= 7; d++) {
          const degree = d as ScaleDegree;
          const q = getDiatonicQuality(degree, scale);
          const chord = makeChord({ scaleDegree: degree, quality: q });
          expect(toRomanNumeral(chord, scale)).toBe(expectedRow[d - 1]);
        }
      }
    });
  });
});

describe('toRomanNumeral — TASK-1A.4 — seventh chord suffixes', () => {
  describe('happy path', () => {
    it('renders IVmaj7 for major-scale degree-4 major triad with maj7 in major', () => {
      const chord = makeChord({
        scaleDegree: 4,
        quality: 'major',
        seventh: 'maj7',
      });
      expect(toRomanNumeral(chord, 'major')).toBe('IVmaj7');
    });

    it('renders V7 for major-scale degree-5 major triad with dom7 in major', () => {
      const chord = makeChord({
        scaleDegree: 5,
        quality: 'major',
        seventh: 'dom7',
      });
      expect(toRomanNumeral(chord, 'major')).toBe('V7');
    });

    it('renders ii7 for major-scale degree-2 minor triad with min7 in major', () => {
      const chord = makeChord({
        scaleDegree: 2,
        quality: 'minor',
        seventh: 'min7',
      });
      expect(toRomanNumeral(chord, 'major')).toBe('ii7');
    });

    it('renders viio7 for leading-tone diminished triad with dim7 in major', () => {
      const chord = makeChord({
        scaleDegree: 7,
        quality: 'diminished',
        seventh: 'dim7',
      });
      expect(toRomanNumeral(chord, 'major')).toBe('viio7');
    });

    it('renders viiø7 for leading-tone diminished triad with half-diminished seventh (min7b5) in major', () => {
      const chord = makeChord({
        scaleDegree: 7,
        quality: 'diminished',
        seventh: 'min7b5',
      });
      expect(toRomanNumeral(chord, 'major')).toBe('viiø7');
    });

    it('renders iMaj7 for harmonic-minor tonic minor triad with maj7 seventh type (minor-major seventh)', () => {
      const chord = makeChord({
        scaleDegree: 1,
        quality: 'minor',
        seventh: 'maj7',
      });
      expect(toRomanNumeral(chord, 'harmonicMinor')).toBe('iMaj7');
    });
  });
});

describe('toRomanNumeral — TASK-1A.4 — suspension and addition suffixes', () => {
  describe('happy path', () => {
    it('appends sus4 to the Roman numeral for a suspended-fourth chord', () => {
      const chord = makeChord({
        scaleDegree: 5,
        quality: 'major',
        suspension: 'sus4',
        seventh: 'none',
      });
      expect(toRomanNumeral(chord, 'major')).toBe('Vsus4');
    });

    it('appends sus2 to the Roman numeral for a suspended-second chord', () => {
      const chord = makeChord({
        scaleDegree: 1,
        quality: 'major',
        suspension: 'sus2',
        seventh: 'none',
      });
      expect(toRomanNumeral(chord, 'major')).toBe('Isus2');
    });

    it('appends add9 when addition is add9 on a triad', () => {
      const chord = makeChord({
        scaleDegree: 1,
        quality: 'major',
        addition: 'add9',
      });
      expect(toRomanNumeral(chord, 'major')).toBe('Iadd9');
    });

    it('appends add11 when addition is add11', () => {
      const chord = makeChord({
        scaleDegree: 4,
        quality: 'major',
        addition: 'add11',
      });
      expect(toRomanNumeral(chord, 'major')).toBe('IVadd11');
    });
  });
});

describe('toRomanNumeral — TASK-1A.4 — inversion notation', () => {
  describe('happy path', () => {
    it('renders first-inversion triad as I6 in major', () => {
      const chord = makeChord({
        scaleDegree: 1,
        quality: 'major',
        inversion: 1,
      });
      expect(toRomanNumeral(chord, 'major')).toBe('I6');
    });

    it('renders second-inversion triad as I64 in major', () => {
      const chord = makeChord({
        scaleDegree: 1,
        quality: 'major',
        inversion: 2,
      });
      expect(toRomanNumeral(chord, 'major')).toBe('I64');
    });

    it('renders first-inversion dominant seventh as V65 in major', () => {
      const chord = makeChord({
        scaleDegree: 5,
        quality: 'major',
        seventh: 'dom7',
        inversion: 1,
      });
      expect(toRomanNumeral(chord, 'major')).toBe('V65');
    });

    it('renders second-inversion dominant seventh as V43 in major', () => {
      const chord = makeChord({
        scaleDegree: 5,
        quality: 'major',
        seventh: 'dom7',
        inversion: 2,
      });
      expect(toRomanNumeral(chord, 'major')).toBe('V43');
    });

    it('renders third-inversion dominant seventh as V42 in major', () => {
      const chord = makeChord({
        scaleDegree: 5,
        quality: 'major',
        seventh: 'dom7',
        inversion: 3,
      });
      expect(toRomanNumeral(chord, 'major')).toBe('V42');
    });
  });
});

describe('toRomanNumeral — TASK-1A.4 — borrowed chords', () => {
  describe('happy path', () => {
    it('prefixes flat for parallel-minor bVII major triad in a major-key context', () => {
      const chord = makeChord({
        scaleDegree: 7,
        quality: 'major',
        borrowed: 'minor',
      });
      expect(toRomanNumeral(chord, 'major')).toBe('bVII');
    });
  });
});

describe('toRomanNumeral — TASK-1A.4 — secondary and applied chords', () => {
  describe('happy path', () => {
    it('renders V/V when secondary function is V and target is the fifth scale degree', () => {
      const chord = makeChord({
        scaleDegree: 2,
        quality: 'major',
        secondary: { function: 'V', target: 5 },
      });
      expect(toRomanNumeral(chord, 'major')).toBe('V/V');
    });

    it('renders viio/V when secondary function is viio and target is the fifth scale degree', () => {
      const chord = makeChord({
        scaleDegree: 7,
        quality: 'diminished',
        secondary: { function: 'viio', target: 5 },
      });
      expect(toRomanNumeral(chord, 'major')).toBe('viio/V');
    });
  });
});

describe('toChordName — TASK-1A.4 — absolute chord symbols in a key', () => {
  describe('happy path', () => {
    it('returns C for degree-1 major triad in C major', () => {
      const chord = makeChord({ scaleDegree: 1, quality: 'major' });
      expect(toChordName(chord, 'C', 'major')).toBe('C');
    });

    it('returns Dm for degree-2 minor triad in C major', () => {
      const chord = makeChord({ scaleDegree: 2, quality: 'minor' });
      expect(toChordName(chord, 'C', 'major')).toBe('Dm');
    });

    it('returns G7 for degree-5 dominant seventh in C major', () => {
      const chord = makeChord({
        scaleDegree: 5,
        quality: 'major',
        seventh: 'dom7',
      });
      expect(toChordName(chord, 'C', 'major')).toBe('G7');
    });

    it('returns Fmaj7 for degree-4 major seventh in C major', () => {
      const chord = makeChord({
        scaleDegree: 4,
        quality: 'major',
        seventh: 'maj7',
      });
      expect(toChordName(chord, 'C', 'major')).toBe('Fmaj7');
    });

    it('returns Bb for bVII borrowed from parallel minor in C major', () => {
      const chord = makeChord({
        scaleDegree: 7,
        quality: 'major',
        borrowed: 'minor',
      });
      expect(toChordName(chord, 'C', 'major')).toBe('Bb');
    });

    it('returns Eaug for degree-3 augmented triad in C harmonic minor', () => {
      const chord = makeChord({
        scaleDegree: 3,
        quality: 'augmented',
      });
      expect(toChordName(chord, 'C', 'harmonicMinor')).toBe('Eaug');
    });
  });
});

describe('toChordName — TASK-1A.4 — slash chords (inversions)', () => {
  describe('happy path', () => {
    it('returns C/E for first-inversion C major triad in C major', () => {
      const chord = makeChord({
        scaleDegree: 1,
        quality: 'major',
        inversion: 1,
      });
      expect(toChordName(chord, 'C', 'major')).toBe('C/E');
    });

    it('returns G7/B for first-inversion G dominant seventh in C major', () => {
      const chord = makeChord({
        scaleDegree: 5,
        quality: 'major',
        seventh: 'dom7',
        inversion: 1,
      });
      expect(toChordName(chord, 'C', 'major')).toBe('G7/B');
    });
  });
});

describe('roman numeral helpers — TASK-1A.4 — purity', () => {
  describe('happy path', () => {
    it('does not mutate the ChordEvent when formatting Roman numerals or chord names', () => {
      const before = makeChord({
        scaleDegree: 3,
        quality: 'minor',
        seventh: 'min7',
      });
      const snapshot = { ...before };
      toRomanNumeral(before, 'major');
      toChordName(before, 'Bb', 'minor');
      expect(before).toEqual(snapshot);
    });

    it('returns the same Roman label on repeated calls with the same arguments', () => {
      const chord = makeChord({ scaleDegree: 6, quality: 'minor', seventh: 'min7' });
      const a = toRomanNumeral(chord, 'major');
      const b = toRomanNumeral(chord, 'major');
      expect(a).toBe(b);
    });

    it('returns the same chord name on repeated calls with the same arguments', () => {
      const chord = makeChord({ scaleDegree: 4, quality: 'major' });
      const a = toChordName(chord, 'G', 'mixolydian');
      const b = toChordName(chord, 'G', 'mixolydian');
      expect(a).toBe(b);
    });
  });
});
