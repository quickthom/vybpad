import type { NoteName, ScaleType, SongData, TimeSignature } from '@vybpad/shared';
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
 * Key in effect at the start of measure `measureIndex`, applying each measure's `changes.key`
 * up to and including that measure (INTERFACES: inherit from metadata or prior).
 */
export function getKeyAtMeasure(song: SongData, measureIndex: number): NoteName {
  let key = song.metadata.key;
  const n = Math.min(measureIndex, song.measures.length - 1);
  for (let j = 0; j <= n; j++) {
    const next = song.measures[j]?.changes?.key;
    if (next) {
      key = next;
    }
  }
  return key;
}

/**
 * Scale/mode in effect at the start of measure `measureIndex`, applying `changes.scale`
 * the same way as {@link getKeyAtMeasure}.
 */
export function getScaleAtMeasure(song: SongData, measureIndex: number): ScaleType {
  let scale = song.metadata.scale;
  const n = Math.min(measureIndex, song.measures.length - 1);
  for (let j = 0; j <= n; j++) {
    const next = song.measures[j]?.changes?.scale;
    if (next) {
      scale = next;
    }
  }
  return scale;
}

/**
 * Tempo (BPM) in effect at the start of measure `measureIndex`, applying each measure's
 * `changes.tempo` up to and including that measure. Falls back to `song.metadata.tempo`.
 * INTERFACES: `MeasureChanges.tempo` (20–300); `song.metadata.tempo` is the initial map before any override.
 */
export function getTempoAtMeasure(song: SongData, measureIndex: number): number {
  let tempo = song.metadata.tempo;
  const n = Math.min(measureIndex, song.measures.length - 1);
  for (let j = 0; j <= n; j++) {
    const next = song.measures[j]?.changes?.tempo;
    if (next !== undefined) {
      tempo = next;
    }
  }
  return tempo;
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

/**
 * Map an absolute tick (song timeline) to the measure index that contains that tick's downbeat region.
 * Used for transport BPM sync and pointer hit-testing (TASK-5.6 / TASK-4.2).
 */
export function measureIndexFromAbsoluteTick(song: SongData, absoluteTick: number): number {
  const starts = getMeasureStartTicks(song);
  const n = song.measures.length;
  if (n === 0) return 0;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    if ((starts[i] ?? 0) <= absoluteTick) idx = i;
  }
  return idx;
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
