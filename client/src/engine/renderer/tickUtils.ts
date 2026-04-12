import type { SongData, TimeSignature } from '@vybpad/shared';
import { TICKS_PER_QUARTER } from '@vybpad/shared';

/** 48 ticks per quarter note — same as {@link TICKS_PER_QUARTER} in `@vybpad/shared`. */
export const TPQN = TICKS_PER_QUARTER;

/**
 * Measure length in ticks: `(numerator / denominator) × 4 × TPQN` (PAT-004 / ARCHITECTURE).
 */
export function measureLengthInTicks(meter: TimeSignature): number {
  return (meter.numerator * 4 * TPQN) / meter.denominator;
}

/**
 * Time signature in effect at the start of measure `measureIndex`, applying each measure's
 * `changes.meter` up to and including that measure (INTERFACES: inherit from metadata or prior).
 */
export function getMeterAtMeasure(song: SongData, measureIndex: number): TimeSignature {
  let meter = song.metadata.meter;
  const n = Math.min(measureIndex, song.measures.length - 1);
  for (let j = 0; j <= n; j++) {
    const next = song.measures[j]?.changes?.meter;
    if (next) {
      meter = next;
    }
  }
  return meter;
}

/**
 * Cumulative tick offset at each measure boundary: `startTicks[i]` is the absolute tick at the
 * start of measure `i`; `startTicks.length === measures.length + 1`.
 */
export function getMeasureStartTicks(song: SongData): number[] {
  const { measures } = song;
  const starts = new Array<number>(measures.length + 1);
  starts[0] = 0;
  for (let i = 0; i < measures.length; i++) {
    const len = measureLengthInTicks(getMeterAtMeasure(song, i));
    starts[i + 1] = starts[i] + len;
  }
  return starts;
}

/** Absolute tick from song start for a position inside a measure (`beat` is tick offset per INTERFACES). */
export function absoluteTickFromMeasurePosition(
  song: SongData,
  measureIndex: number,
  tickOffsetInMeasure: number,
): number {
  const starts = getMeasureStartTicks(song);
  return starts[measureIndex] + tickOffsetInMeasure;
}
