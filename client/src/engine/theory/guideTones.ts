import type { ChordEvent, ScaleDegree, ScaleType } from '@vybpad/shared';
import { chordToneOffsetsFromRoot } from './chords';
import { getScaleIntervals } from './scales';

export type GuideCompatibility = 'chord-tone' | 'scale-tone' | 'chromatic';

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

/** Shortest distance between two pitch classes on the chromatic circle. */
function circularSemitoneDistance(a: number, b: number): number {
  const diff = Math.abs(mod12(a) - mod12(b));
  return Math.min(diff, 12 - diff);
}

/**
 * Maps a pitch class to the home scale degree whose diatonic pitch class is nearest
 * (exact match preferred; ties break toward the lower scale degree).
 */
function pitchClassToHomeScaleDegree(pc: number, homeScale: ScaleType): ScaleDegree {
  const intervals = getScaleIntervals(homeScale);
  const target = mod12(pc);

  for (let d = 1; d <= 7; d++) {
    if (mod12(intervals[d - 1]) === target) {
      return d as ScaleDegree;
    }
  }

  let best: ScaleDegree = 1;
  let bestDist = 12;
  for (let d = 1; d <= 7; d++) {
    const ipc = mod12(intervals[d - 1]);
    const dist = circularSemitoneDistance(target, ipc);
    if (dist < bestDist || (dist === bestDist && d < best)) {
      bestDist = dist;
      best = d as ScaleDegree;
    }
  }
  return best;
}

function rootPitchClassFromTonic(scaleDegree: ScaleDegree, mode: ScaleType): number {
  const intervals = getScaleIntervals(mode);
  return mod12(intervals[scaleDegree - 1]);
}

/** Pitch classes (0–11) of all chord tones, relative to tonic = 0, ignoring register. */
function chordTonePitchClasses(chord: ChordEvent, homeScale: ScaleType): Set<number> {
  const rootMode = chord.borrowed ?? homeScale;
  const rootPc = rootPitchClassFromTonic(chord.scaleDegree, rootMode);
  const pcs = new Set<number>();
  for (const off of chordToneOffsetsFromRoot(chord)) {
    pcs.add(mod12(rootPc + off));
  }
  return pcs;
}

/** Pitch classes of the seven diatonic scale degrees in `scale` (tonic = 0). */
function scaleTonePitchClasses(scale: ScaleType): Set<number> {
  const intervals = getScaleIntervals(scale);
  const pcs = new Set<number>();
  for (let d = 0; d < 7; d++) {
    pcs.add(mod12(intervals[d]));
  }
  return pcs;
}

/**
 * Returns scale degrees (in the current `scale`) that correspond to chord tones.
 * Root spelling follows `chord.borrowed` when set (same as chordToMidiNotes); each
 * resulting pitch class maps to a home-scale degree for highlighting.
 */
export function getChordTones(chord: ChordEvent, scale: ScaleType): ScaleDegree[] {
  const rootMode = chord.borrowed ?? scale;
  const rootPc = rootPitchClassFromTonic(chord.scaleDegree, rootMode);
  const degrees: ScaleDegree[] = [];

  for (const off of chordToneOffsetsFromRoot(chord)) {
    const tonePc = mod12(rootPc + off);
    degrees.push(pitchClassToHomeScaleDegree(tonePc, scale));
  }
  return degrees;
}

/**
 * Classifies how a melody pitch (degree + chromatic) relates to the active chord.
 * Chord tones use the same spelling rules as `chordToMidiNotes` (borrowed mode for root).
 * Scale membership uses the diatonic `scale` (home scale), not the borrowed mode.
 */
export function getGuideCompatibility(
  degree: ScaleDegree,
  chromatic: number,
  chord: ChordEvent,
  scale: ScaleType,
): GuideCompatibility {
  const homeIntervals = getScaleIntervals(scale);
  const notePc = mod12(homeIntervals[degree - 1] + chromatic);

  const chordPcs = chordTonePitchClasses(chord, scale);
  if (chordPcs.has(notePc)) {
    return 'chord-tone';
  }

  const scalePcs = scaleTonePitchClasses(scale);
  if (scalePcs.has(notePc)) {
    return 'scale-tone';
  }

  return 'chromatic';
}
