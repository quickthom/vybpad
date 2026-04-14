import type { NoteName, ScaleType } from '@vybpad/shared';

import { noteNameToMidiBase } from './noteNames';
import { getScaleIntervals } from './scales';

/** Chromatic pitch classes (0–11) for the current key + scale. */
export function pitchClassSetForKeyScale(key: NoteName, scale: ScaleType): Set<number> {
  const t = noteNameToMidiBase(key) % 12;
  const iv = getScaleIntervals(scale);
  return new Set(iv.map((i) => (t + i) % 12));
}

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) {
    if (!b.has(x)) return false;
  }
  return true;
}

const ALL_SCALE_TYPES: ScaleType[] = [
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

const ALL_NOTE_NAMES: NoteName[] = [
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
 * Finds which of our `ScaleType` values, rooted at `tonic`, yields `target` pitch classes.
 * Used for “relative” key changes: same key signature, new tonic.
 */
export function findScaleTypeWithPitchClassSet(tonic: NoteName, target: Set<number>): ScaleType | null {
  for (const s of ALL_SCALE_TYPES) {
    if (setsEqual(pitchClassSetForKeyScale(tonic, s), target)) {
      return s;
    }
  }
  return null;
}

/**
 * Finds tonics that support `nextScale` while matching `target` pitch classes (relative scale change).
 */
export function findTonicsForScaleAndPitchClassSet(nextScale: ScaleType, target: Set<number>): NoteName[] {
  return ALL_NOTE_NAMES.filter((k) => setsEqual(pitchClassSetForKeyScale(k, nextScale), target));
}

/**
 * Parallel: new tonic, same mode (transpose the mode to the selected root).
 * Relative: new tonic, mode chosen so pitch-class content matches the previous key signature (when possible).
 */
export function applyKeyChange(
  prevKey: NoteName,
  prevScale: ScaleType,
  nextKey: NoteName,
  transposition: 'parallel' | 'relative',
): { key: NoteName; scale: ScaleType } {
  if (transposition === 'parallel') {
    return { key: nextKey, scale: prevScale };
  }
  const target = pitchClassSetForKeyScale(prevKey, prevScale);
  const scale = findScaleTypeWithPitchClassSet(nextKey, target);
  if (scale != null) {
    return { key: nextKey, scale };
  }
  // e.g. new tonic not in the previous diatonic collection — keep mode, match KeyScaleSelector intent
  return { key: nextKey, scale: prevScale };
}

/**
 * Parallel: new mode on the same tonic (parallel major/minor, etc.).
 * Relative: new mode on the tonic that preserves the previous key signature (e.g. C major → A minor).
 */
export function applyScaleChange(
  prevKey: NoteName,
  prevScale: ScaleType,
  nextScale: ScaleType,
  transposition: 'parallel' | 'relative',
): { key: NoteName; scale: ScaleType } {
  if (transposition === 'parallel') {
    return { key: prevKey, scale: nextScale };
  }
  const target = pitchClassSetForKeyScale(prevKey, prevScale);
  const tonics = findTonicsForScaleAndPitchClassSet(nextScale, target);
  if (tonics.length === 1) {
    return { key: tonics[0], scale: nextScale };
  }
  if (tonics.length > 1) {
    // Extremely rare: pick stable order (lowest chromatic) for determinism
    const sorted = [...tonics].sort((a, b) => noteNameToMidiBase(a) - noteNameToMidiBase(b));
    return { key: sorted[0], scale: nextScale };
  }
  return { key: prevKey, scale: nextScale };
}
