import type { NoteEvent, ScaleType, SongData, NoteName } from '@vybpad/shared';

import { scaleDegreeToMidi } from '../theory/scaleDegreeToMidi';
import { getKeyAtMeasure, getScaleAtMeasure } from './tickUtils';

/** Span threshold used by OB-14: show at least one octave of context. */
export const MIN_OCTAVE_SPAN_SEMITONES = 12;
const MIN_MIDI_PITCH = 0;
const MAX_MIDI_PITCH = 127;

/** Neutral fallback used when a voice has no non-rest notes. */
export const EMPTY_VOICE_PITCH_RANGE = {
  minPitch: 60,
  maxPitch: 72,
  hasNotes: false,
} as const;

export interface VoicePitchRange {
  minPitch: number;
  maxPitch: number;
  hasNotes: boolean;
}

type MeasureVoiceNotes = readonly NoteEvent[];

function notePitch(note: NoteEvent, key: NoteName, scale: ScaleType): number {
  return scaleDegreeToMidi(note.scaleDegree, note.octave, note.chromatic, key, scale);
}

function ensureFiniteRange(range: VoicePitchRange): VoicePitchRange {
  if (!Number.isFinite(range.minPitch) || !Number.isFinite(range.maxPitch) || range.maxPitch < range.minPitch) {
    return EMPTY_VOICE_PITCH_RANGE;
  }
  if (range.minPitch < MIN_MIDI_PITCH || range.maxPitch > MAX_MIDI_PITCH) {
    return {
      minPitch: Math.min(MAX_MIDI_PITCH, Math.max(MIN_MIDI_PITCH, Math.round(range.minPitch))),
      maxPitch: Math.min(MAX_MIDI_PITCH, Math.max(MIN_MIDI_PITCH, Math.round(range.maxPitch))),
      hasNotes: range.hasNotes,
    };
  }
  return {
    minPitch: Math.round(range.minPitch),
    maxPitch: Math.round(range.maxPitch),
    hasNotes: range.hasNotes,
  };
}

/**
 * Expand a finite note span so it always spans at least 12 semitones when notes exist.
 * This keeps narrow melodies visible with at least one octave of context.
 */
export function clampSpanToMinOctave(rawRange: VoicePitchRange): VoicePitchRange {
  const range = ensureFiniteRange(rawRange);
  const span = range.maxPitch - range.minPitch;
  if (!range.hasNotes || span >= MIN_OCTAVE_SPAN_SEMITONES) {
    return range;
  }

  const missing = MIN_OCTAVE_SPAN_SEMITONES - span;
  const expandLow = Math.floor(missing / 2);
  const expandHigh = missing - expandLow;

  let minPitch = range.minPitch - expandLow;
  let maxPitch = range.maxPitch + expandHigh;

  if (minPitch < MIN_MIDI_PITCH) {
    maxPitch += MIN_MIDI_PITCH - minPitch;
    minPitch = MIN_MIDI_PITCH;
  }
  if (maxPitch > MAX_MIDI_PITCH) {
    minPitch -= maxPitch - MAX_MIDI_PITCH;
    maxPitch = MAX_MIDI_PITCH;
  }

  minPitch = Math.max(minPitch, MIN_MIDI_PITCH);
  maxPitch = Math.min(maxPitch, MAX_MIDI_PITCH);

  if (maxPitch - minPitch < MIN_OCTAVE_SPAN_SEMITONES) {
    if (minPitch === MIN_MIDI_PITCH) {
      maxPitch = Math.min(MAX_MIDI_PITCH, minPitch + MIN_OCTAVE_SPAN_SEMITONES);
    } else if (maxPitch === MAX_MIDI_PITCH) {
      minPitch = Math.max(MIN_MIDI_PITCH, maxPitch - MIN_OCTAVE_SPAN_SEMITONES);
    }
  }

  return {
    minPitch,
    maxPitch,
    hasNotes: true,
  };
}

function scanVoice(song: SongData, voice: number): VoicePitchRange {
  let minPitch = Number.POSITIVE_INFINITY;
  let maxPitch = Number.NEGATIVE_INFINITY;

  for (let measureIndex = 0; measureIndex < song.measures.length; measureIndex++) {
    const measure = song.measures[measureIndex];
    if (measure == null) continue;

    const notes = measure.notes[voice] as MeasureVoiceNotes | undefined;
    if (notes == null || notes.length === 0) continue;

    const key = getKeyAtMeasure(song, measureIndex);
    const scale = getScaleAtMeasure(song, measureIndex);

    for (const note of notes) {
      if (note.isRest) continue;
      const pitch = notePitch(note, key, scale);
      if (pitch < minPitch) minPitch = pitch;
      if (pitch > maxPitch) maxPitch = pitch;
    }
  }

  if (!Number.isFinite(minPitch) || !Number.isFinite(maxPitch)) {
    return { ...EMPTY_VOICE_PITCH_RANGE };
  }

  return clampSpanToMinOctave({
    minPitch,
    maxPitch,
    hasNotes: true,
  });
}

/**
 * OB-14 pitch groundwork:
 * Returns the comparable pitch metric range for each melody voice (0..3),
 * scanning all measures and ignoring rests. We use absolute MIDI pitch
 * (`scaleDegreeToMidi`) as the comparable unit so span expansion can
 * enforce a minimum of one octave (12 semitones).
 */
export function computeVoicePitchRanges(song: SongData): [VoicePitchRange, VoicePitchRange, VoicePitchRange, VoicePitchRange] {
  return [scanVoice(song, 0), scanVoice(song, 1), scanVoice(song, 2), scanVoice(song, 3)];
}
