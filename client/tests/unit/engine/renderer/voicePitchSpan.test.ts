/*
 * QA COVERAGE PLAN — UI-R2-W5.1
 *
 * Criterion 1: `minSpanApplied` is asserted as true when fallback expansion to minimum span is used.
 *   happy: natural span below minimum expands to `MIN_VOICE_PITCH_SPAN_SEMITONES` and sets `minSpanApplied` to true.
 *   edges: expansion at MIDI bounds still returns a 12-semitone span.
 *
 * Criterion 2: `minSpanApplied` is asserted as false when the computed span already meets minimum span naturally.
 *   happy: natural >= 12 semitone span keeps raw bounds and `minSpanApplied` false.
 *   edges: measure-local key/scale changes keep computed bounds stable.
 *
 * Criterion 3: `client/tests/unit/engine/renderer/voicePitchSpan.test.ts` has one deduplicated spec structure.
 *   happy: shared helpers and imports are declared once and reused by all tests.
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
  describe('happy path', () => {
    it('returns a 12-semitone expansion and sets minSpanApplied when natural span is too narrow', () => {
      const result = computeVoicePitchSpan(
        songWithVoices({
          ...emptyMeasure('narrow'),
          notes: [
            [
              note({ id: 'n1', scaleDegree: 1, beat: 0, duration: 24 }),
              note({ id: 'n2', scaleDegree: 3, beat: 24, duration: 24 }),
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
        minMidi: 56,
        maxMidi: 68,
        pitchSpanSemitones: MIN_VOICE_PITCH_SPAN_SEMITONES,
      });
    });

    it('keeps raw computed bounds and sets minSpanApplied false when span is already large enough', () => {
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

    it('scans every measure and only evaluates the requested voice index', () => {
      const result = computeVoicePitchSpan(
        songWithVoices(
          {
            ...emptyMeasure('m0'),
            notes: [
              [
                note({ id: 'v0-a', scaleDegree: 1, beat: 0, duration: 24 }),
                note({ id: 'v0-b', scaleDegree: 2, beat: 24, duration: 24 }),
              ],
              [note({ id: 'v1', scaleDegree: 7, beat: 0, duration: 24 })],
              [],
              [],
            ],
          } as Measure,
          {
            ...emptyMeasure('m1'),
            notes: [
              [note({ id: 'v0-c', scaleDegree: 1, beat: 0, duration: 24, octave: 1 })],
              [note({ id: 'v1-only', scaleDegree: 3, beat: 0, duration: 24 })],
              [note({ id: 'v2-only', scaleDegree: 5, beat: 0, duration: 24 })],
              [],
            ],
          } as Measure,
          {
            ...emptyMeasure('m2'),
            notes: [
              [note({ id: 'v0-rest', scaleDegree: 3, beat: 0, duration: 24, isRest: true })],
              [note({ id: 'v1-late', scaleDegree: 6, beat: 0, duration: 24 })],
              [note({ id: 'v2-late', scaleDegree: 4, beat: 0, duration: 24 })],
              [],
            ],
          } as Measure,
        ),
        0,
      );

      expect(result).toMatchObject({
        voiceIndex: 0,
        hasNotes: true,
        minSpanApplied: false,
        minMidi: 60,
        maxMidi: 72,
        pitchSpanSemitones: MIN_VOICE_PITCH_SPAN_SEMITONES,
      });
    });

    it('uses measure-local key and scale when converting scale degrees', () => {
      const result = computeVoicePitchSpan(
        songWithVoices(
          {
            ...emptyMeasure('m0'),
            notes: [[note({ id: 'c0', scaleDegree: 1, beat: 0, duration: 24 })]],
          } as Measure,
          {
            ...emptyMeasure('m1'),
            changes: { key: 'G', scale: 'major' },
            notes: [[note({ id: 'c1', scaleDegree: 4, beat: 0, duration: 24 })]],
          } as Measure,
          {
            ...emptyMeasure('m2'),
            changes: { key: 'F#', scale: 'minor' },
            notes: [[note({ id: 'c2', scaleDegree: 5, beat: 0, duration: 24 })]],
          } as Measure,
        ),
        0,
      );

      expect(result).toMatchObject({
        voiceIndex: 0,
        hasNotes: true,
        minSpanApplied: false,
        minMidi: 60,
        maxMidi: 73,
        pitchSpanSemitones: 13,
      });
    });
  });

  describe('error handling', () => {
    it('returns deterministic fallback span when selected voice has no usable notes', () => {
      const result = computeVoicePitchSpan(
        songWithVoices({
          ...emptyMeasure('empty'),
          notes: [
            [note({ id: 'r', scaleDegree: 1, beat: 0, duration: 24, isRest: true })],
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

    it('does not throw on malformed measure arrays and still computes a valid selected-voice span', () => {
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
        ],
        bandConfig: { tracks: [] },
      } as unknown as SongData;

      expect(() => computeVoicePitchSpan(malformedSong, 0)).not.toThrow();
      const result = computeVoicePitchSpan(malformedSong, 0);

      expect(result).toMatchObject({
        voiceIndex: 0,
        hasNotes: true,
        minSpanApplied: true,
        minMidi: 60,
        maxMidi: 72,
        pitchSpanSemitones: MIN_VOICE_PITCH_SPAN_SEMITONES,
      });
    });

    it('skips non-object measure entries safely and still computes valid notes', () => {
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
          null as unknown,
          {
            ...emptyMeasure('next'),
            notes: [[note({ id: 'ok', scaleDegree: 1, beat: 0, duration: 24 })]],
          },
        ],
        bandConfig: { tracks: [] },
      } as unknown as SongData;

      expect(() => computeVoicePitchSpan(malformedSong, 0)).not.toThrow();
      const result = computeVoicePitchSpan(malformedSong, 0);

      expect(result).toMatchObject({
        voiceIndex: 0,
        hasNotes: true,
        minSpanApplied: false,
        minMidi: 60,
        maxMidi: 72,
        pitchSpanSemitones: MIN_VOICE_PITCH_SPAN_SEMITONES,
      });
    });
  });

  describe('edge cases', () => {
    it('keeps expanded range within MIDI bounds when span expansion hits limits', () => {
      const result = computeVoicePitchSpan(
        songWithVoices({
          ...emptyMeasure('edge'),
          notes: [[note({ id: 'high', scaleDegree: 7, octave: 9, beat: 0, duration: 24 })]],
        } as Measure),
        0,
      );

      expect(result).toEqual(
        expect.objectContaining({
          voiceIndex: 0,
          hasNotes: true,
          minSpanApplied: true,
        }),
      );
      expect(result.minMidi).toBe(115);
      expect(result.maxMidi).toBe(127);
      expect(result.pitchSpanSemitones).toBe(12);
    });
  });
});
