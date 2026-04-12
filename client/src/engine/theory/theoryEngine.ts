import type {
  ChordEvent,
  ChordQuality,
  NoteName,
  ScaleDegree,
  ScaleType,
  SeventhType,
} from '@vybpad/shared';
import {
  chordToMidiNotes,
  getDiatonicQuality,
  getDiatonicSeventh,
} from './chords';
import { getChordTones, getGuideCompatibility } from './guideTones';
import { toChordName, toRomanNumeral } from './romanNumerals';
import { scaleDegreeToMidi } from './scaleDegreeToMidi';
import { getScaleIntervals } from './scales';

/**
 * Music theory engine contract from INTERFACES.md — single object for imports and testing.
 * All methods delegate to existing modules; no duplicated logic.
 */
export interface TheoryEngine {
  getScaleIntervals(scale: ScaleType): number[];

  scaleDegreeToMidi(
    degree: ScaleDegree,
    octave: number,
    chromatic: number,
    key: NoteName,
    scale: ScaleType,
    baseOctave?: number,
  ): number;

  chordToMidiNotes(
    chord: ChordEvent,
    key: NoteName,
    scale: ScaleType,
    voicingOctave?: number,
  ): number[];

  getDiatonicQuality(degree: ScaleDegree, scale: ScaleType): ChordQuality;

  getDiatonicSeventh(degree: ScaleDegree, scale: ScaleType): SeventhType;

  toRomanNumeral(chord: ChordEvent, scale: ScaleType): string;

  toChordName(chord: ChordEvent, key: NoteName, scale: ScaleType): string;

  getChordTones(chord: ChordEvent, scale: ScaleType): ScaleDegree[];

  getGuideCompatibility(
    degree: ScaleDegree,
    chromatic: number,
    chord: ChordEvent,
    scale: ScaleType,
  ): 'chord-tone' | 'scale-tone' | 'chromatic';
}

export const theoryEngine: TheoryEngine = {
  getScaleIntervals,
  scaleDegreeToMidi,
  chordToMidiNotes,
  getDiatonicQuality,
  getDiatonicSeventh,
  toRomanNumeral,
  toChordName,
  getChordTones,
  getGuideCompatibility,
};
