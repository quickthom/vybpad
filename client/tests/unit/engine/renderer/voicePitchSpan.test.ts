/*
 * QA COVERAGE PLAN — UI-R2-W5.1
 *
 * Criterion 1: per-voice cross-measure scan
 *   happy: scan all measures for the selected voice and ignore non-selected voices
 *   error: selected voice has no entries while another voice has notes
 *
 * Criterion 2: measure-local key/scale conversion
 *   happy: use each measure’s inherited key/scale before converting NoteEvent to MIDI
 *   error: cross-measure key/scale changes alter resulting bounds
 *
 * Criterion 3: minimum 12-semitone span + minSpanApplied
 *   happy: raw spans under 12 expand to exactly 12 semitones and set minSpanApplied=true
 *   edge: expansion remains bounded to MIDI 0..127
 *
 * Criterion 4: no expansion when already >= 12
 *   happy: raw spans >=12 keep exact min/max and set minSpanApplied=false
 *   edge: exact 12-semitone span remains unchanged
 *
 * Criterion 5: fallback and malformed data safety
 *   happy: no usable notes for the selected voice yields fallback [60, 72] and hasNotes=false
 *   errors: malformed measure entries and malformed notes are skipped without throwing
 */
import type { Measure, NoteEvent, SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  MIN_VOICE_PITCH_SPAN_SEMITONES,
  computeVoicePitchSpan,
} from '../../../../src/engine/renderer/layout';

function emptyMeasure(id: string): Measure {
  return { id, chords: [], notes: [[], [], [], []] };
}

function songWithVoices(...measures: Measure[]): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'pitch-span',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [...measures],
    bandConfig: { tracks: [] },
  };
}

function note(partial: Partial<NoteEvent> & Pick<NoteEvent, 'beat' | 'duration' | 'id'>): NoteEvent {
  return {
    id: partial.id,
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    velocity: 100,
    beat: partial.beat,
    duration: partial.duration,
    isRest: false,
    ...partial,
  };
}

describe('computeVoicePitchSpan — UI-R2-W5.1', () => {
  it('scans all measures and only counts notes from the selected voice', () => {
    const result = computeVoicePitchSpan(
      songWithVoices(
        {
          ...emptyMeasure('m0'),
          notes: [
            [note({ id: 'v0a', scaleDegree: 1, beat: 0, duration: 24 })],
            [note({ id: 'v1a', scaleDegree: 7, beat: 0, duration: 24 })],
            [],
            [],
          ],
        } as Measure,
        {
          ...emptyMeasure('m1'),
          notes: [
            [],
            [note({ id: 'v1b', scaleDegree: 4, beat: 0, duration: 24 })],
            [note({ id: 'v2a', scaleDegree: 6, beat: 0, duration: 24 })],
            [],
          ],
        } as Measure,
        {
          ...emptyMeasure('m2'),
          notes: [
            [note({ id: 'v0b', scaleDegree: 1, beat: 0, duration: 24, octave: 1 })],
            [],
            [],
            [],
          ],
        } as Measure,
      ),
      0,
    );

    expect(result).toMatchObject({
      voiceIndex: 0,
      hasNotes: true,
      minMidi: 60,
      maxMidi: 72,
      minSpanApplied: false,
      pitchSpanSemitones: 12,
    });
  });

  it('uses measure-local key/scale conversion for each measure while scanning', () => {
    const result = computeVoicePitchSpan(
      songWithVoices(
        {
          ...emptyMeasure('m0'),
          notes: [[note({ id: 'c0', scaleDegree: 1, beat: 0, duration: 24 })]],
        } as Measure,
        {
          ...emptyMeasure('m1'),
          changes: { key: 'G', scale: 'major' },
          notes: [[note({ id: 'c1', scaleDegree: 5, beat: 0, duration: 24 })]],
        } as Measure,
        {
          ...emptyMeasure('m2'),
          changes: { key: 'F#', scale: 'minor' },
          notes: [[note({ id: 'c2', scaleDegree: 1, beat: 0, duration: 24 })]],
        } as Measure,
      ),
      0,
    );

    expect(result).toMatchObject({
      voiceIndex: 0,
      hasNotes: true,
      minSpanApplied: false,
      minMidi: 60,
      maxMidi: 76,
      pitchSpanSemitones: 16,
    });
  });

  it('expands a narrow span to the 12-semitone floor and sets minSpanApplied=true', () => {
    const result = computeVoicePitchSpan(
      songWithVoices({
        ...emptyMeasure('narrow'),
        notes: [
          [
            note({ id: 'n1', scaleDegree: 1, beat: 0, duration: 24 }),
            note({ id: 'n2', scaleDegree: 2, beat: 24, duration: 24 }),
          ],
          [],
          [],
          [],
        ],
      } as Measure),
      0,
    );

    expect(result).toMatchObject({
      voiceIndex: 0,
      hasNotes: true,
      minSpanApplied: true,
      minMidi: 55,
      maxMidi: 67,
      pitchSpanSemitones: MIN_VOICE_PITCH_SPAN_SEMITONES,
    });
  });

  it('keeps exact bounds when span is already >= 12 semitones', () => {
    const result = computeVoicePitchSpan(
      songWithVoices({
        ...emptyMeasure('wide'),
        notes: [
          [
            note({ id: 'w1', scaleDegree: 1, beat: 0, duration: 24 }),
            note({ id: 'w2', scaleDegree: 1, beat: 24, duration: 24, octave: 1 }),
          ],
          [],
          [],
          [],
        ],
      } as Measure),
      0,
    );

    expect(result).toMatchObject({
      voiceIndex: 0,
      hasNotes: true,
      minSpanApplied: false,
      minMidi: 60,
      maxMidi: 72,
      pitchSpanSemitones: 12,
    });
  });

  it('returns deterministic fallback when selected voice has no usable notes', () => {
    const result = computeVoicePitchSpan(
      songWithVoices({
        ...emptyMeasure('empty'),
        notes: [
          [note({ id: 'rest', scaleDegree: 1, beat: 0, duration: 24, isRest: true })],
          [note({ id: 'other', scaleDegree: 1, beat: 0, duration: 24 })],
          [note({ id: 'other2', scaleDegree: 2, beat: 0, duration: 24, octave: 1 })],
          [],
        ],
      } as Measure),
      0,
    );

    expect(result).toMatchObject({
      voiceIndex: 0,
      hasNotes: false,
      minMidi: 60,
      maxMidi: 72,
      pitchSpanSemitones: MIN_VOICE_PITCH_SPAN_SEMITONES,
      minSpanApplied: false,
    });
  });

  it('ignores malformed measure entries and still computes a valid selected-voice span', () => {
    const malformedSong = {
      version: '1.0',
      metadata: {
        title: 'malformed',
        key: 'C',
        scale: 'major',
        tempo: 120,
        meter: { numerator: 4, denominator: 4 },
      },
      measures: [
        {
          id: 'bad-notes',
          chords: [],
          notes: 'no notes yet' as unknown as [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]],
          changes: { key: 5 as unknown as 'C', scale: 'major' },
        },
        {
          id: 'mixed',
          chords: [],
          notes: [
            [note({ id: 'ok', scaleDegree: 6, beat: 0, duration: 24 })] as NoteEvent[],
            [note({ id: 'invalid-degree', scaleDegree: 0 as unknown as 1, beat: 0, duration: 24 })] as unknown as NoteEvent[],
            'invalid' as unknown as NoteEvent[],
            null as unknown as NoteEvent[],
          ] as unknown as [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]],
        },
        null as unknown as NoteEvent[],
      ],
      bandConfig: { tracks: [] },
    } as unknown as SongData;

    expect(() => computeVoicePitchSpan(malformedSong, 0)).not.toThrow();
    const result = computeVoicePitchSpan(malformedSong, 0);

    expect(result).toMatchObject({
      voiceIndex: 0,
      hasNotes: true,
      minSpanApplied: true,
      minMidi: 69,
      maxMidi: 69,
      pitchSpanSemitones: MIN_VOICE_PITCH_SPAN_SEMITONES,
    });
  });

  it('expands spans near MIDI bounds safely without leaving 0..127', () => {
    const result = computeVoicePitchSpan(
      songWithVoices({
        ...emptyMeasure('top'),
        notes: [[note({ id: 'high', scaleDegree: 7, octave: 9, beat: 0, duration: 24 })]],
      } as Measure),
      0,
    );

    expect(result.hasNotes).toBe(true);
    expect(result.minMidi).toBeGreaterThanOrEqual(0);
    expect(result.maxMidi).toBeLessThanOrEqual(127);
    expect(result.pitchSpanSemitones).toBe(MIN_VOICE_PITCH_SPAN_SEMITONES);
    expect(result.minSpanApplied).toBe(true);
    expect(result.maxMidi).toBe(127);
    expect(result.minMidi).toBe(115);
  });
});

import type { Measure, NoteEvent, SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  MIN_VOICE_PITCH_SPAN_SEMITONES,
  computeVoicePitchSpan,
} from '../../../../src/engine/renderer/layout';

function emptyMeasure(id: string): Measure {
  return { id, chords: [], notes: [[], [], [], []] };
}

function songWithVoices(...measures: Measure[]): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'pitch-span',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [...measures],
    bandConfig: { tracks: [] },
  };
}

function note(partial: Partial<NoteEvent> & Pick<NoteEvent, 'beat' | 'duration' | 'id'>): NoteEvent {
  return {
    id: partial.id,
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    velocity: 100,
    beat: partial.beat,
    duration: partial.duration,
    isRest: false,
    ...partial,
  };
}

describe('computeVoicePitchSpan', () => {
  it('computes min/max from only the specified melody voice', () => {
    const song = songWithVoices({
      ...emptyMeasure('m0'),
      notes: [
        [note({ id: 'a', scaleDegree: 1, beat: 0, duration: 24 })],
        [note({ id: 'b', scaleDegree: 7, beat: 0, duration: 24 })],
        [],
        [],
      ],
    } as Measure);

    const result = computeVoicePitchSpan(song, 0);

    expect(result.hasNotes).toBe(true);
    expect(result.voiceIndex).toBe(0);
    expect(result.minMidi).toBe(54);
    expect(result.maxMidi).toBe(66);
    expect(result.minSpanApplied).toBe(true);
    expect(result.pitchSpanSemitones).toBe(MIN_VOICE_PITCH_SPAN_SEMITONES);
    expect(computeVoicePitchSpan(song, 1).minSpanApplied).toBe(true);
  });

  it('respects measure-local key/scale context for each conversion', () => {
    const song = songWithVoices(
      {
        ...emptyMeasure('m0'),
        notes: [[note({ id: 'c0', scaleDegree: 1, beat: 0, duration: 24 })]],
      } as Measure,
      {
        ...emptyMeasure('m1'),
        changes: { key: 'G', scale: 'major' },
        notes: [[note({ id: 'c1', scaleDegree: 5, beat: 0, duration: 24 })]],
      } as Measure,
    );

    const result = computeVoicePitchSpan(song, 0);

    expect(result.hasNotes).toBe(true);
    // Without local context C-major + G-major, this range would be 60..67; measure-local context yields 60..74.
    expect(result.minSpanApplied).toBe(false);
    expect(result.minMidi).toBe(60);
    expect(result.maxMidi).toBe(74);
    expect(result.pitchSpanSemitones).toBe(14);
  });

  it('returns fallback span when a voice has no notes (or only rests)', () => {
    const song = songWithVoices({
      ...emptyMeasure('r0'),
      notes: [
        [note({ id: 'r', scaleDegree: 1, beat: 0, duration: 24, isRest: true })],
        [],
        [],
        [],
      ],
    } as Measure);

    const result = computeVoicePitchSpan(song, 0);

    expect(result.hasNotes).toBe(false);
    expect(result.minMidi).toBe(60);
    expect(result.maxMidi).toBe(72);
    expect(result.pitchSpanSemitones).toBe(12);
    expect(result.minSpanApplied).toBe(false);
  });

  it('handles malformed measure note sequences without throwing and ignores invalid notes', () => {
    const malformedSong = {
      version: '1.0',
      metadata: {
        title: 'malformed',
        key: 'C',
        scale: 'major',
        tempo: 120,
        meter: { numerator: 4, denominator: 4 },
      },
      measures: [
        {
          id: 'bad',
          chords: [],
          notes: 'no notes yet' as unknown as [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]],
        },
        {
          id: 'ok',
          chords: [],
          notes: [
            [note({ id: 'ok', scaleDegree: 6, beat: 0, duration: 24 })] as NoteEvent[],
            [note({ id: 'noise', scaleDegree: 2, beat: 0, duration: 24 })] as unknown as NoteEvent[],
            'invalid',
            [],
          ] as unknown as [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]],
        },
      ],
      bandConfig: { tracks: [] },
    } as unknown as SongData;

    const result = computeVoicePitchSpan(malformedSong, 0);

    expect(result.hasNotes).toBe(true);
    expect(result.minMidi).toBe(63);
    expect(result.maxMidi).toBe(75);
    expect(result.minSpanApplied).toBe(true);
    expect(result.pitchSpanSemitones).toBe(12);
  });

  it('expands spans near MIDI bounds safely without leaving 0..127', () => {
    const song = songWithVoices({
      ...emptyMeasure('top'),
      notes: [[note({ id: 'high', scaleDegree: 7, octave: 9, beat: 0, duration: 24 })]],
    } as Measure);

    const result = computeVoicePitchSpan(song, 0);

    expect(result.hasNotes).toBe(true);
    expect(result.minMidi).toBeGreaterThanOrEqual(0);
    expect(result.maxMidi).toBeLessThanOrEqual(127);
    expect(result.pitchSpanSemitones).toBe(MIN_VOICE_PITCH_SPAN_SEMITONES);
    expect(result.minSpanApplied).toBe(true);
    expect(result.maxMidi).toBe(127);
    expect(result.minMidi).toBe(115);
  });
});

