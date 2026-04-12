import type { ScaleType } from '@vybpad/shared';

/** Semitone offsets from tonic for each supported scale/mode (degree order 1–7). */
const SCALE_INTERVALS: Record<ScaleType, readonly number[]> = {
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

/**
 * Returns semitone intervals from the tonic for the given scale or mode.
 * Each value is the distance in semitones from the root to that scale degree.
 */
export function getScaleIntervals(scale: ScaleType): number[] {
  return [...SCALE_INTERVALS[scale]];
}
