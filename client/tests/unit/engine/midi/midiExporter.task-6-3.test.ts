/*
 * QA COVERAGE — Task 6.3 (conductor tempo map + time signature changes)
 */

import { createMidiExporter } from '@/engine/midi';
import { getMeasureStartTicks, getMeterAtMeasure, getTempoAtMeasure } from '@/engine/renderer/tickUtils';
import type { ChordEvent, NoteEvent, SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  ff51EventsFromTrack,
  ff58EventsFromTrack,
  firstTrackPayload,
  listMTrkPayloads,
  noteSpansFromTrack,
  parseSmfHeader,
  tracksWithNoteData,
} from '../../../helpers/smfTestUtils';

function fixedId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(12, '0')}`;
}

const DEFAULT_BAND: SongData['bandConfig'] = {
  tracks: [
    { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
    { role: 'melody2', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
    { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
    { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
    { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
    { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
    { role: 'drums', instrument: 'piano', volume: 0.0, mute: true, octave: 0 },
  ],
};

function emptyMeasure(idSuffix: number): SongData['measures'][0] {
  return {
    id: fixedId('10000000-0000-4000-8000', idSuffix),
    chords: [],
    notes: [[], [], [], []],
  };
}

function quarterMelody(beat: number, idSuffix: number): NoteEvent {
  return {
    id: fixedId('30000000-0000-4000-8000', idSuffix),
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    beat,
    duration: 48,
    isRest: false,
    velocity: 100,
  };
}

/** Four empty 4/4 bars; optional mid-song tempo on measure index 2. */
function buildFourBarSong(opts?: { tempoAtMeasure2?: number }): SongData {
  const measures: SongData['measures'] = [
    emptyMeasure(1),
    emptyMeasure(2),
    {
      ...emptyMeasure(3),
      changes: opts?.tempoAtMeasure2 !== undefined ? { tempo: opts.tempoAtMeasure2 } : undefined,
    },
    emptyMeasure(4),
  ];
  measures[0] = {
    ...measures[0]!,
    chords: [
      {
        id: fixedId('20000000-0000-4000-8000', 1),
        scaleDegree: 1,
        quality: 'major',
        seventh: 'maj7',
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: null,
        beat: 0,
        duration: 192,
      } satisfies ChordEvent,
    ],
    notes: [[quarterMelody(0, 1)], [], [], []],
  };
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-6.3 tempo map',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures,
    bandConfig: DEFAULT_BAND,
  };
}

/** Meter switches to 3/4 at measure index 2 (two leading 4/4 bars). */
function buildMeterChangeAtMeasure2(): SongData {
  const measures: SongData['measures'] = [
    emptyMeasure(1),
    emptyMeasure(2),
    {
      ...emptyMeasure(3),
      changes: { meter: { numerator: 3, denominator: 4 } },
    },
    emptyMeasure(4),
  ];
  measures[0] = {
    ...measures[0]!,
    notes: [[quarterMelody(0, 1)], [], [], []],
  };
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-6.3 meter change',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures,
    bandConfig: DEFAULT_BAND,
  };
}

function usecFromBpm(bpm: number): number {
  return Math.round(60_000_000 / bpm);
}

describe('TASK-6.3 MidiExporter — conductor tempo map (INTERFACES § MidiExporter)', () => {
  const exporter = createMidiExporter();

  describe('regression — constant tempo/meter', () => {
    it('still produces Type 1 SMF at 480 PPQN with expected note scheduling (TASK-6.1 / 6.2)', () => {
      const song = buildFourBarSong();
      const bytes = exporter.exportSong(song);
      const header = parseSmfHeader(bytes);
      expect(header.format).toBe(1);
      expect(header.ticksPerQuarter).toBe(480);
      expect(listMTrkPayloads(bytes).length).toBeGreaterThanOrEqual(4);
      expect(tracksWithNoteData(bytes).length).toBeGreaterThanOrEqual(2);

      const tracks = listMTrkPayloads(bytes);
      let found480 = false;
      for (const tr of tracks) {
        for (const s of noteSpansFromTrack(tr)) {
          if (s.endTick - s.startTick === 480) found480 = true;
        }
      }
      expect(found480).toBe(true);
    });

    it('emits a single FF 51 / FF 58 baseline when tempo and meter are constant', () => {
      const song = buildFourBarSong();
      const cond = firstTrackPayload(exporter.exportSong(song));
      const tempos = ff51EventsFromTrack(cond);
      const meters = ff58EventsFromTrack(cond);
      expect(tempos.length).toBe(1);
      expect(meters.length).toBe(1);
      expect(tempos[0]!.usecPerQuarter).toBe(usecFromBpm(120));
      expect(meters[0]!.numerator).toBe(4);
      expect(meters[0]!.denominator).toBe(4);
    });
  });

  describe('tempo change at measure M > 0', () => {
    it('places Set Tempo at scaled measure-start tick with BPM from getTempoAtMeasure(song, M)', () => {
      const song = buildFourBarSong({ tempoAtMeasure2: 140 });
      expect(getTempoAtMeasure(song, 1)).toBe(120);
      expect(getTempoAtMeasure(song, 2)).toBe(140);

      const internalStartM2 = getMeasureStartTicks(song)[2]!;
      const INTERNAL_TO_MIDI_TICK = 10;
      const MIDI_EXPLICIT_TICK_PAD = 1;
      const expectedAbsMidi = internalStartM2 * INTERNAL_TO_MIDI_TICK + MIDI_EXPLICIT_TICK_PAD;

      const cond = firstTrackPayload(exporter.exportSong(song));
      const tempos = ff51EventsFromTrack(cond).sort((a, b) => a.absTick - b.absTick);
      expect(tempos.length).toBe(2);
      expect(tempos[0]!.absTick).toBe(1);
      expect(tempos[0]!.usecPerQuarter).toBe(usecFromBpm(120));
      expect(tempos[1]!.absTick).toBe(expectedAbsMidi);
      expect(tempos[1]!.usecPerQuarter).toBe(usecFromBpm(140));
    });
  });

  describe('time signature change', () => {
    it('emits FF 58 for the new meter at the measure boundary per getMeterAtMeasure', () => {
      const song = buildMeterChangeAtMeasure2();
      expect(getMeterAtMeasure(song, 1).numerator).toBe(4);
      expect(getMeterAtMeasure(song, 2).numerator).toBe(3);

      const internalStartM2 = getMeasureStartTicks(song)[2]!;
      const expectedAbsMidi = internalStartM2 * 10 + 1;

      const cond = firstTrackPayload(exporter.exportSong(song));
      const meters = ff58EventsFromTrack(cond).sort((a, b) => a.absTick - b.absTick);
      expect(meters.length).toBe(2);
      expect(meters[0]!.absTick).toBe(1);
      expect(meters[0]!.numerator).toBe(4);
      expect(meters[1]!.absTick).toBe(expectedAbsMidi);
      expect(meters[1]!.numerator).toBe(3);
      expect(meters[1]!.denominator).toBe(4);
    });
  });

  describe('exportMelodyOnly parity with exportSong', () => {
    it('uses the same conductor-track FF 51 / FF 58 sequence as exportSong', () => {
      const song = buildFourBarSong({ tempoAtMeasure2: 90 });
      const full = firstTrackPayload(exporter.exportSong(song));
      const melo = firstTrackPayload(exporter.exportMelodyOnly(song));

      const tFull = ff51EventsFromTrack(full);
      const tMelo = ff51EventsFromTrack(melo);
      const mFull = ff58EventsFromTrack(full);
      const mMelo = ff58EventsFromTrack(melo);

      expect(tFull.map((e) => [e.absTick, e.usecPerQuarter])).toEqual(
        tMelo.map((e) => [e.absTick, e.usecPerQuarter]),
      );
      expect(mFull.map((e) => [e.absTick, e.numerator, e.denominator])).toEqual(
        mMelo.map((e) => [e.absTick, e.numerator, e.denominator]),
      );
    });
  });
});
