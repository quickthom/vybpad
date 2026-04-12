import type {
  ChordEvent,
  ChordQuality,
  NoteName,
  ScaleDegree,
  ScaleType,
  SecondaryChord,
  SecondaryFunction,
} from '@vybpad/shared';
import { chordToMidiNotes, getDiatonicQuality } from './chords';
import { noteNameToMidiBase } from './noteNames';
import { scaleDegreeToMidi } from './scaleDegreeToMidi';
import { getScaleIntervals } from './scales';

/** Canonical spelling: C, C#, D, …, B for pitch classes 0–11. */
const PC_TO_SHARP_NAME: readonly NoteName[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

/**
 * Temporary tonic for a secondary chord: absolute root of the target degree, and major vs minor
 * local key (from the target triad’s quality in the home scale — major vs minor contexts).
 */
export function resolveSecondaryTarget(
  secondary: SecondaryChord,
  key: NoteName,
  scale: ScaleType,
): { targetKey: NoteName; targetScale: ScaleType } {
  const intervals = getScaleIntervals(scale);
  const tonicPc = noteNameToMidiBase(key) % 12;
  const targetIdx = secondary.target - 1;
  const targetPc = (tonicPc + intervals[targetIdx] + 12) % 12;
  const targetKey = PC_TO_SHARP_NAME[targetPc];

  const q = getDiatonicQuality(secondary.target, scale);
  // Brief: major-quality targets → major; minor-quality → minor. Map other tertian qualities to the nearest mode.
  const targetScale: ScaleType =
    q === 'major' || q === 'augmented' ? 'major' : 'minor';

  return { targetKey, targetScale };
}

/**
 * MIDI notes for a secondary/applied chord: resolves temporary key from `secondary`, then `chordToMidiNotes`
 * so `chord.scaleDegree` is interpreted in that key (Hookpad model: degree is in the tonicized key).
 */
export function getSecondaryChordMidi(
  secondary: SecondaryChord,
  chord: ChordEvent,
  key: NoteName,
  scale: ScaleType,
  voicingOctave?: number,
): number[] {
  const { targetKey, targetScale } = resolveSecondaryTarget(secondary, key, scale);
  const baseOct = voicingOctave ?? 4;
  // Align register with the home key: same pitch class as the temporary tonic’s chord root should use
  // the octave spelling that `scaleDegreeToMidi` would use for that pitch class in the home scale
  // (so V/V lines up with the home diatonic pitch of the secondary root, e.g. D4 not D5 in C major).
  const rawRoot = scaleDegreeToMidi(chord.scaleDegree, 0, 0, targetKey, targetScale, baseOct);
  const rootPc = ((rawRoot % 12) + 12) % 12;
  const homeIntervals = getScaleIntervals(scale);
  const tonicPc = noteNameToMidiBase(key) % 12;
  let alignedOct = baseOct;
  for (let d = 1; d <= 7; d++) {
    if ((tonicPc + homeIntervals[d - 1]) % 12 === rootPc) {
      const homeRootMidi = scaleDegreeToMidi(d as ScaleDegree, 0, 0, key, scale, baseOct);
      const octaveDelta = Math.round((homeRootMidi - rawRoot) / 12);
      alignedOct = baseOct + octaveDelta;
      break;
    }
  }
  return chordToMidiNotes(chord, targetKey, targetScale, alignedOct);
}

export function getAvailableSecondaryChords(
  scale: ScaleType,
): { function: SecondaryFunction; target: ScaleDegree; quality: ChordQuality }[] {
  const result: { function: SecondaryFunction; target: ScaleDegree; quality: ChordQuality }[] = [];
  const referenceKey: NoteName = 'C';

  const functions: SecondaryFunction[] = ['V', 'viio', 'IV'];

  for (const fn of functions) {
    const quality = secondaryFunctionChordQuality(fn);
    for (let t = 1; t <= 7; t++) {
      const target = t as ScaleDegree;

      if (fn === 'V' && getDiatonicQuality(target, scale) === 'diminished') {
        continue;
      }

      const rootChord = makeSecondaryRootChord(fn, quality);
      const secondaryPcs = chordPitchClassesSorted(
        getSecondaryChordMidi({ function: fn, target }, rootChord, referenceKey, scale, 4),
      );

      if (matchesAnyDiatonicTriad(secondaryPcs, referenceKey, scale)) {
        continue;
      }

      result.push({ function: fn, target, quality });
    }
  }

  return result;
}

function secondaryFunctionChordQuality(fn: SecondaryFunction): ChordQuality {
  switch (fn) {
    case 'V':
      return 'major';
    case 'viio':
      return 'diminished';
    case 'IV':
      return 'major';
  }
}

/** Scale degree of the secondary chord’s root within the tonicized key (V = 5, viio = 7, IV = 4). */
function secondaryRootDegree(fn: SecondaryFunction): ScaleDegree {
  switch (fn) {
    case 'V':
      return 5;
    case 'viio':
      return 7;
    case 'IV':
      return 4;
  }
}

/** Minimal `ChordEvent` for the secondary’s root (degree is in the tonicized key). `secondary` unused by `chordToMidiNotes`. */
function makeSecondaryRootChord(fn: SecondaryFunction, quality: ChordQuality): ChordEvent {
  return {
    id: '00000000-0000-4000-8000-000000000000',
    scaleDegree: secondaryRootDegree(fn),
    quality,
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat: 0,
    duration: 48,
  };
}

function chordPitchClassesSorted(midiNotes: number[]): number[] {
  const pcs = [...new Set(midiNotes.map((m) => ((m % 12) + 12) % 12))];
  pcs.sort((a, b) => a - b);
  return pcs;
}

function matchesAnyDiatonicTriad(
  secondaryPcs: readonly number[],
  key: NoteName,
  scale: ScaleType,
): boolean {
  for (let d = 1; d <= 7; d++) {
    const degree = d as ScaleDegree;
    const diatonic: ChordEvent = {
      id: '00000000-0000-4000-8000-000000000001',
      scaleDegree: degree,
      quality: getDiatonicQuality(degree, scale),
      seventh: 'none',
      suspension: 'none',
      addition: 'none',
      inversion: 0,
      borrowed: null,
      secondary: null,
      beat: 0,
      duration: 48,
    };
    const diatonicPcs = chordPitchClassesSorted(chordToMidiNotes(diatonic, key, scale, 4));
    if (arraysEqual(secondaryPcs, diatonicPcs)) {
      return true;
    }
  }
  return false;
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
