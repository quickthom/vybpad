import type { ChordQuality, ScaleDegree, ScaleType, SeventhType } from '@vybpad/shared';
import { getDiatonicQuality, getDiatonicSeventh } from './chords';
import { getScaleIntervals } from './scales';

/** Describes one scale degree where the parallel borrowed mode differs from the home mode. */
export interface BorrowedChordInfo {
  scaleDegree: ScaleDegree;
  homeQuality: ChordQuality;
  borrowedQuality: ChordQuality;
  homeSeventh: SeventhType;
  borrowedSeventh: SeventhType;
  /** True when the borrowed scale’s interval at this degree (from tonic) differs from the home scale’s. */
  rootAltered: boolean;
  /** Semitone delta: borrowedInterval − homeInterval for this degree (same tonic). */
  rootAlteration: number;
}

/**
 * Lists each degree where the borrowed (parallel) mode produces a different diatonic chord than the home mode.
 * A degree is included when the root pitch class changes, or the diatonic triad/seventh type changes.
 */
export function getBorrowedChords(homeScale: ScaleType, borrowedScale: ScaleType): BorrowedChordInfo[] {
  const homeIntervals = getScaleIntervals(homeScale);
  const borrowedIntervals = getScaleIntervals(borrowedScale);
  const out: BorrowedChordInfo[] = [];

  for (let d = 1; d <= 7; d++) {
    const degree = d as ScaleDegree;
    const i = d - 1;
    const hi = homeIntervals[i];
    const bi = borrowedIntervals[i];
    const rootAltered = hi !== bi;
    const rootAlteration = bi - hi;

    const homeQuality = getDiatonicQuality(degree, homeScale);
    const borrowedQuality = getDiatonicQuality(degree, borrowedScale);
    const homeSeventh = getDiatonicSeventh(degree, homeScale);
    const borrowedSeventh = getDiatonicSeventh(degree, borrowedScale);

    const triadOrSeventhDiffers =
      homeQuality !== borrowedQuality || homeSeventh !== borrowedSeventh;

    if (!rootAltered && !triadOrSeventhDiffers) {
      continue;
    }

    out.push({
      scaleDegree: degree,
      homeQuality,
      borrowedQuality,
      homeSeventh,
      borrowedSeventh,
      rootAltered,
      rootAlteration,
    });
  }

  return out;
}
