/*
 * QA COVERAGE PLAN — UI-R2-W5.1 / OB-14
 *
 * Criterion 1: per-voice scan across all measures (ignore rests, include only non-rest notes)
 *   happy: range contains finite MIDI bounds for voices with non-rest content and excludes rests
 *   error/edges: all-rest voices produce no finite pitch bounds
 *
 * Criterion 2: minimum octave span expansion
 *   happy: single-note voice returns a span with width >= 12 semitones and includes the note
 *   edges: output remains finite and within MIDI bounds
 *
 * Criterion 3: chromatic offsets are part of pitch metric
 *   happy: chromatic ± notes are reflected in the returned bounds
 *   edges: mixed chromatic offsets in same voice produce expected expanded span
 *
 * Criterion 4: voice isolation
 *   happy: ranges are computed independently per voice index (0..3)
 *   edges: two voices with disjoint material produce disjoint pitch spans
 *
 * Criterion 5: pure-function behavior
 *   happy: repeated calls with frozen input are deterministic and do not mutate SongData
 *   error/edges: output has no mutation effects on the input song object
 *
 * Ambiguous case documented:
 *   for voices with no non-rest notes, this suite expects `null` (instead of +/-Infinity).
 */

import type { NoteEvent, SongData, Measure } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import { scaleDegreeToMidi } from '../../../../src/engine/theory/scaleDegreeToMidi';
import { computeMelodyVoicePitchRanges } from '../../../../src/engine/renderer/layout';

type PitchRange = { minMidi: number; maxMidi: number } | null;
type VoiceRangeByIndex = readonly (PitchRange | null)[];

function note(options: {
  id: string;
  scaleDegree: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  octave: number;
  chromatic: number;
  beat: number;
  duration: number;
  isRest: boolean;
}): NoteEvent {
  return {
    id: options.id,
    scaleDegree: options.scaleDegree,
    octave: options.octave,
    chromatic: options.chromatic,
    beat: options.beat,
    duration: options.duration,
    isRest: options.isRest,
    velocity: 100,
  };
}

function measure(voiceMap: Partial<Record<0 | 1 | 2 | 3, NoteEvent[]>> = {}): Measure {
  return {
    id: 'm-' + Math.random().toString(16).slice(2),
    chords: [],
    notes: [
      voiceMap[0] ?? [],
      voiceMap[1] ?? [],
      voiceMap[2] ?? [],
      voiceMap[3] ?? [],
    ],
    changes: undefined,
  };
}

function song(measures: Measure[]): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'OB-14 range analysis',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures,
    bandConfig: {
      tracks: [
        { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
        { role: 'melody2', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
        { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
        { role: 'drums', instrument: 'piano', volume: 0.0, mute: true, octave: 0 },
      ],
    },
  };
}

function rangeFor(voiceRanges: VoiceRangeByIndex, voice: 0 | 1 | 2 | 3): PitchRange {
  return voiceRanges[voice] ?? null;
}

function asMidi(n: NoteEvent): number {
  return scaleDegreeToMidi(n.scaleDegree, n.octave, n.chromatic, 'C', 'major');
}

function deepFreeze<T extends object>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'object' && item !== null) {
        deepFreeze(item as object);
      }
    }
    return Object.freeze(value) as T;
  }
  const props = Object.getOwnPropertyNames(value);
  for (const key of props) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === 'object' && v !== null) {
      deepFreeze(v as object);
    }
  }
  return Object.freeze(value) as T;
}

describe('layout — melody pitch ranges (UI-R2-W5.1)', () => {
  it('returns finite pitch bounds for non-rest notes and ignores rests while scanning all measures and voices', () => {
    const low = note({
      id: '00000000-0000-0000-0000-000000000001',
      scaleDegree: 4,
      octave: 0,
      chromatic: 0,
      beat: 0,
      duration: 24,
      isRest: false,
    });
    const low2 = note({
      id: '00000000-0000-0000-0000-000000000002',
      scaleDegree: 1,
      octave: 0,
      chromatic: 0,
      beat: 12,
      duration: 24,
      isRest: false,
    });
    const highRest = note({
      id: '00000000-0000-0000-0000-000000000003',
      scaleDegree: 1,
      octave: 9,
      chromatic: 0,
      beat: 24,
      duration: 12,
      isRest: true,
    });
    const v1note = note({
      id: '00000000-0000-0000-0000-000000000004',
      scaleDegree: 5,
      octave: -1,
      chromatic: 0,
      beat: 48,
      duration: 24,
      isRest: false,
    });
    const v2rest = note({
      id: '00000000-0000-0000-0000-000000000005',
      scaleDegree: 3,
      octave: 0,
      chromatic: 0,
      beat: 0,
      duration: 24,
      isRest: true,
    });

    const s = song([
      measure({
        0: [low, highRest],
        1: [v1note],
        2: [v2rest],
      }),
      measure({
        0: [low2],
      }),
    ]);

    const result = computeMelodyVoicePitchRanges(s) as VoiceRangeByIndex;
    const v0Range = rangeFor(result, 0);
    const v1Range = rangeFor(result, 1);
    const v2Range = rangeFor(result, 2);
    const v3Range = rangeFor(result, 3);

    expect(v0Range).not.toBeNull();
    expect(v1Range).not.toBeNull();
    expect(v2Range).toBeNull();
    expect(v3Range).toBeNull();

    const nonRestPitchesVoice0 = [asMidi(low), asMidi(low2)];
    expect(v0Range?.minMidi).toBeLessThanOrEqual(Math.min(...nonRestPitchesVoice0));
    expect(v0Range?.maxMidi).toBeGreaterThanOrEqual(Math.max(...nonRestPitchesVoice0));
    expect(v0Range?.maxMidi).toBeLessThan(asMidi(highRest));
    expect(v0Range?.minMidi).toBeGreaterThanOrEqual(0);
    expect(v0Range?.maxMidi).toBeLessThanOrEqual(127);

    const nonRestPitchV1 = [asMidi(v1note)];
    expect(v1Range?.minMidi).toBeLessThanOrEqual(nonRestPitchV1[0]);
    expect(v1Range?.maxMidi).toBeGreaterThanOrEqual(nonRestPitchV1[0]);
    expect(v1Range?.minMidi).toBeFinite();
    expect(v1Range?.maxMidi).toBeFinite();
  });

  it('returns null for all-rest/no-note voices (documented default for empty ranges)', () => {
    const r0 = note({
      id: '00000000-0000-0000-0000-000000000101',
      scaleDegree: 1,
      octave: 0,
      chromatic: 0,
      beat: 0,
      duration: 12,
      isRest: true,
    });
    const r1 = note({
      id: '00000000-0000-0000-0000-000000000102',
      scaleDegree: 5,
      octave: 0,
      chromatic: 0,
      beat: 12,
      duration: 12,
      isRest: true,
    });

    const s = song([
      measure({ 0: [r0], 1: [r1], 2: [r1], 3: [r1] }),
      measure({ 0: [r0], 1: [r1], 2: [r1], 3: [r1] }),
    ]);

    const result = computeMelodyVoicePitchRanges(s) as VoiceRangeByIndex;
    for (const r of result) {
      expect(r).toBeNull();
    }
  });

  it('expands a single non-rest pitch to at least one-octave span and keeps note inside', () => {
    const center = note({
      id: '00000000-0000-0000-0000-000000000201',
      scaleDegree: 3,
      octave: 0,
      chromatic: 0,
      beat: 0,
      duration: 24,
      isRest: false,
    });
    const s = song([
      measure({ 0: [center] }),
    ]);
    const result = computeMelodyVoicePitchRanges(s) as VoiceRangeByIndex;
    const v0Range = rangeFor(result, 0);

    expect(v0Range).not.toBeNull();
    expect(v0Range?.maxMidi).toBeGreaterThanOrEqual(asMidi(center));
    expect(v0Range?.minMidi).toBeLessThanOrEqual(asMidi(center));
    expect(v0Range?.maxMidi - v0Range?.minMidi).toBeGreaterThanOrEqual(12);
    expect(v0Range?.minMidi).toBeGreaterThanOrEqual(0);
    expect(v0Range?.maxMidi).toBeLessThanOrEqual(127);
  });

  it('uses wide intervallic leaps to set span so both extremes remain enclosed', () => {
    const low = note({
      id: '00000000-0000-0000-0000-000000000301',
      scaleDegree: 1,
      octave: 0,
      chromatic: 0,
      beat: 0,
      duration: 24,
      isRest: false,
    });
    const high = note({
      id: '00000000-0000-0000-0000-000000000302',
      scaleDegree: 7,
      octave: 1,
      chromatic: 0,
      beat: 24,
      duration: 24,
      isRest: false,
    });
    const s = song([
      measure({ 1: [low, high] }),
    ]);

    const result = computeMelodyVoicePitchRanges(s) as VoiceRangeByIndex;
    const v1Range = rangeFor(result, 1);
    const lowMidi = asMidi(low);
    const highMidi = asMidi(high);

    expect(v1Range).not.toBeNull();
    expect(v1Range?.minMidi).toBeLessThanOrEqual(lowMidi);
    expect(v1Range?.maxMidi).toBeGreaterThanOrEqual(highMidi);
    expect(v1Range?.maxMidi - v1Range?.minMidi).toBeGreaterThanOrEqual(highMidi - lowMidi);
  });

  it('includes chromatic offsets in min/max pitch metric (non-zero chromatic test)', () => {
    const flat = note({
      id: '00000000-0000-0000-0000-000000000401',
      scaleDegree: 4,
      octave: 0,
      chromatic: -1,
      beat: 0,
      duration: 24,
      isRest: false,
    });
    const sharp = note({
      id: '00000000-0000-0000-0000-000000000402',
      scaleDegree: 4,
      octave: 0,
      chromatic: 2,
      beat: 24,
      duration: 24,
      isRest: false,
    });
    const s = song([
      measure({ 2: [flat, sharp] }),
    ]);

    const result = computeMelodyVoicePitchRanges(s) as VoiceRangeByIndex;
    const v2Range = rangeFor(result, 2);
    const flatMidi = asMidi(flat);
    const sharpMidi = asMidi(sharp);

    expect(v2Range).not.toBeNull();
    expect(v2Range?.minMidi).toBeLessThanOrEqual(Math.min(flatMidi, sharpMidi));
    expect(v2Range?.maxMidi).toBeGreaterThanOrEqual(Math.max(flatMidi, sharpMidi));
    expect(v2Range?.minMidi).not.toBe(asMidi({ ...flat, chromatic: 0 }));
    expect(v2Range?.maxMidi).not.toBe(asMidi({ ...flat, chromatic: 0 }));
    expect(v2Range?.maxMidi - v2Range?.minMidi).toBeGreaterThanOrEqual(12);
  });

  it('keeps distinct ranges for two voices with disjoint pitch material', () => {
    const v0Low = note({
      id: '00000000-0000-0000-0000-000000000501',
      scaleDegree: 1,
      octave: 0,
      chromatic: 0,
      beat: 0,
      duration: 24,
      isRest: false,
    });
    const v0High = note({
      id: '00000000-0000-0000-0000-000000000502',
      scaleDegree: 2,
      octave: 0,
      chromatic: 0,
      beat: 24,
      duration: 24,
      isRest: false,
    });
    const v1Low = note({
      id: '00000000-0000-0000-0000-000000000503',
      scaleDegree: 1,
      octave: 4,
      chromatic: 0,
      beat: 0,
      duration: 24,
      isRest: false,
    });
    const v1High = note({
      id: '00000000-0000-0000-0000-000000000504',
      scaleDegree: 2,
      octave: 4,
      chromatic: 0,
      beat: 24,
      duration: 24,
      isRest: false,
    });
    const s = song([
      measure({ 0: [v0Low, v0High], 1: [v1Low, v1High] }),
    ]);

    const result = computeMelodyVoicePitchRanges(s) as VoiceRangeByIndex;
    const v0Range = rangeFor(result, 0);
    const v1Range = rangeFor(result, 1);

    expect(v0Range).not.toBeNull();
    expect(v1Range).not.toBeNull();
    expect(v0Range?.maxMidi).toBeLessThan(v1Range?.minMidi);
  });

  it('is a pure function: deterministic result and no SongData mutation', () => {
    const noteA = note({
      id: '00000000-0000-0000-0000-000000000601',
      scaleDegree: 4,
      octave: 0,
      chromatic: 0,
      beat: 0,
      duration: 24,
      isRest: false,
    });
    const noteB = note({
      id: '00000000-0000-0000-0000-000000000602',
      scaleDegree: 6,
      octave: 1,
      chromatic: -1,
      beat: 24,
      duration: 24,
      isRest: false,
    });

    const frozenSong = deepFreeze(
      song([
        measure({
          0: [noteA],
          1: [noteB],
        }),
      ]),
    );
    const before = JSON.stringify(frozenSong);
    const first = computeMelodyVoicePitchRanges(frozenSong) as VoiceRangeByIndex;
    const second = computeMelodyVoicePitchRanges(frozenSong) as VoiceRangeByIndex;

    expect(JSON.parse(before)).toMatchObject(JSON.parse(JSON.stringify(frozenSong)));
    expect(first).toEqual(second);
  });
});
