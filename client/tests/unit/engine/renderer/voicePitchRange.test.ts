import type { Measure, NoteEvent, SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_VOICE_PITCH_RANGE,
  clampSpanToMinOctave,
  computeVoicePitchRanges,
  MIN_OCTAVE_SPAN_SEMITONES,
} from '../../../../src/engine/renderer/voicePitchRange';
import { scaleDegreeToMidi } from '../../../../src/engine/theory/scaleDegreeToMidi';

function emptyMeasure(id: string): Measure {
  return { id, chords: [], notes: [[], [], [], []] };
}

function minimalSong(measureCount: number): SongData {
  const measures: Measure[] = [];
  for (let i = 0; i < measureCount; i += 1) {
    measures.push(emptyMeasure(`00000000-0000-4000-8000-0000000000${i + 10}`));
  }

  return {
    version: '1.0',
    metadata: {
      title: 'Pitch range test song',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures,
    bandConfig: { tracks: [] },
  };
}

function note(partial: Partial<NoteEvent> & Pick<NoteEvent, 'beat' | 'duration'>): NoteEvent {
  return {
    id: 'note-id',
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    velocity: 100,
    isRest: false,
    ...partial,
  };
}

describe('voicePitchRange (OB-14)', () => {
  it('returns a neutral empty range for voices with only rests or no non-rest notes', () => {
    const song = minimalSong(2);
    song.measures[0].notes[0] = [note({ isRest: true })];
    song.measures[0].notes[2] = [note({ isRest: true })];
    song.measures[1].notes[0] = [note({ isRest: true })];

    const ranges = computeVoicePitchRanges(song);
    expect(ranges[0]).toEqual(EMPTY_VOICE_PITCH_RANGE);
    expect(ranges[1]).toEqual(EMPTY_VOICE_PITCH_RANGE);
    expect(ranges[2]).toEqual(EMPTY_VOICE_PITCH_RANGE);
    expect(ranges[3]).toEqual(EMPTY_VOICE_PITCH_RANGE);
  });

  it('expands a single note to a minimum one-octave span', () => {
    const song = minimalSong(1);
    song.measures[0].notes[1] = [note({ scaleDegree: 3, octave: 0, beat: 0, duration: 48 })];
    const pitch = scaleDegreeToMidi(3, 0, 0, 'C', 'major');

    const ranges = computeVoicePitchRanges(song);
    expect(ranges[1]).toEqual(clampSpanToMinOctave({
      minPitch: pitch,
      maxPitch: pitch,
      hasNotes: true,
    }));
    expect(ranges[1].maxPitch - ranges[1].minPitch).toBe(MIN_OCTAVE_SPAN_SEMITONES);
  });

  it('handles wide melodic interval spans without shrinking an already-large span', () => {
    const song = minimalSong(2);
    song.measures[0].notes[0] = [note({ scaleDegree: 1, octave: 0, beat: 0, duration: 48 })];
    song.measures[1].notes[0] = [note({ scaleDegree: 1, octave: 2, beat: 0, duration: 48 })];
    const lowPitch = scaleDegreeToMidi(1, 0, 0, 'C', 'major');
    const highPitch = scaleDegreeToMidi(1, 2, 0, 'C', 'major');

    const ranges = computeVoicePitchRanges(song);
    expect(ranges[0]).toEqual({
      hasNotes: true,
      minPitch: Math.min(lowPitch, highPitch),
      maxPitch: Math.max(lowPitch, highPitch),
    });
  });

  it('respects chromatic offsets and expands around the resulting midi span', () => {
    const song = minimalSong(1);
    const lower = scaleDegreeToMidi(4, 0, -1, 'C', 'major');
    const upper = scaleDegreeToMidi(4, 0, 1, 'C', 'major');
    song.measures[0].notes[3] = [
      note({ scaleDegree: 4, chromatic: -1, beat: 0, duration: 48 }),
      note({ scaleDegree: 4, chromatic: 1, beat: 24, duration: 48 }),
    ];

    const ranges = computeVoicePitchRanges(song);
    expect(ranges[3]).toEqual(clampSpanToMinOctave({
      minPitch: Math.min(lower, upper),
      maxPitch: Math.max(lower, upper),
      hasNotes: true,
    }));
    expect(ranges[3].maxPitch - ranges[3].minPitch).toBe(MIN_OCTAVE_SPAN_SEMITONES);
  });

  it('keeps pitch ranges per-voice isolated across measure scans', () => {
    const song = minimalSong(3);
    const lowPitch = scaleDegreeToMidi(1, -1, 0, 'C', 'major');
    const highPitch = scaleDegreeToMidi(7, 1, 0, 'C', 'major');
    song.measures[0].notes[0] = [note({ scaleDegree: 1, octave: -1, beat: 0, duration: 48 })];
    song.measures[1].notes[1] = [note({ scaleDegree: 7, octave: 1, beat: 0, duration: 48 })];

    const ranges = computeVoicePitchRanges(song);
    expect(ranges[0]).toEqual(clampSpanToMinOctave({
      minPitch: lowPitch,
      maxPitch: 48,
      hasNotes: true,
    }));
    expect(ranges[1]).toEqual(clampSpanToMinOctave({
      minPitch: highPitch,
      maxPitch: 83,
      hasNotes: true,
    }));
    expect(ranges[0].maxPitch).toBeLessThan(ranges[1].minPitch);
  });
});
