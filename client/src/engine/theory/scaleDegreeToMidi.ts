import type { NoteName, ScaleDegree, ScaleType } from '@vybpad/shared';
import { noteNameToMidiBase } from './noteNames';
import { getScaleIntervals } from './scales';

const DEFAULT_BASE_OCTAVE = 4;

/**
 * Converts scale degree, relative octave, and chromatic offset to a MIDI note number
 * in the given key and scale. `baseOctave` sets where scale degree 1 / octave 0 is anchored
 * (default 4 → align with middle C for C major).
 *
 * Formula: tonicMidi + scaleIntervals[degree - 1] + (octave * 12) + chromatic,
 * where tonicMidi = noteNameToMidiBase(key) + (baseOctave * 12) + 12.
 */
export function scaleDegreeToMidi(
  degree: ScaleDegree,
  octave: number,
  chromatic: number,
  key: NoteName,
  scale: ScaleType,
  baseOctave: number = DEFAULT_BASE_OCTAVE,
): number {
  const tonicMidi = noteNameToMidiBase(key) + baseOctave * 12 + 12;
  const intervals = getScaleIntervals(scale);
  const raw = tonicMidi + intervals[degree - 1] + octave * 12 + chromatic;
  const rounded = Math.round(raw);
  return Math.max(0, Math.min(127, rounded));
}
