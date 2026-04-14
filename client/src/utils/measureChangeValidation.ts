import type { MeasureChanges, TimeSignature } from '@vybpad/shared';

/** INTERFACES.md `MeasureChanges.tempo` / `SongMetadata.tempo` — BPM 20–300 integer. */
export function isValidTempo(bpm: number): boolean {
  return Number.isInteger(bpm) && bpm >= 20 && bpm <= 300;
}

const VALID_DENOMINATORS = new Set([1, 2, 4, 8, 16, 32]);

/** PAT-004: common-practice meters; numerator 1–32, denominator power-of-two beat unit. */
export function isValidMeter(m: TimeSignature): boolean {
  const { numerator, denominator } = m;
  if (!Number.isInteger(numerator) || numerator < 1 || numerator > 32) {
    return false;
  }
  if (!Number.isInteger(denominator) || !VALID_DENOMINATORS.has(denominator)) {
    return false;
  }
  return true;
}

/** Merge incoming measure changes, dropping invalid tempo/meter fields (store defense-in-depth). */
export function mergeMeasureChanges(prev: MeasureChanges | undefined, incoming: MeasureChanges): MeasureChanges {
  const base: MeasureChanges = { ...prev };
  if (incoming.key !== undefined) base.key = incoming.key;
  if (incoming.scale !== undefined) base.scale = incoming.scale;
  if (incoming.tempo !== undefined) {
    if (isValidTempo(incoming.tempo)) {
      base.tempo = incoming.tempo;
    }
  }
  if (incoming.meter !== undefined) {
    if (isValidMeter(incoming.meter)) {
      base.meter = incoming.meter;
    }
  }
  return base;
}
