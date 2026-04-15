/*
 * QA COVERAGE PLAN — TASK-6.7 (consolidated MIDI export integration)
 * ─────────────────────────────────────────────────────────────────
 * Criterion 1: Observable SMF outputs — byte-level / parsed structure (smfTestUtils)
 *   happy: createDragBlob matches exportSong bytes; minimal song still valid SMF1/480
 *   edges: empty measures → no note spans, no FF01 chord texts; conductor still present
 *
 * Criterion 2: exportMelodyOnly vs exportSong — conductor parity on minimal material
 *   happy: identical FF51/FF58 on track 0 for same empty song (extends TASK-6.3 pattern)
 *
 * Criterion 3: Multi-measure tempo map — sequential mid-score changes
 *   happy: two BPM changes after measure 0 → three FF51 events at measure-start ticks
 *   (TASK-6.3 covers a single change; this fills a gap without repeating those assertions)
 */

import { createMidiExporter, MIDI_TICK_SCALE } from '@/engine/midi';
import {
  getMeasureStartTicks,
  getTempoAtMeasure,
} from '@/engine/renderer/tickUtils';
import type { SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  conductorTempoAndMeterMetasFromTrack,
  ff01EventsInFile,
  firstTrackPayload,
  parseSmfHeader,
  tracksWithNoteData,
} from '../../../helpers/smfTestUtils';

const MIDI_EXPLICIT_TICK_PAD = 1;

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

function fixedId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(12, '0')}`;
}

function internalAbsTickToMidiTick(absInternal: number): number {
  return absInternal * MIDI_TICK_SCALE + MIDI_EXPLICIT_TICK_PAD;
}

function expectedUsecPerQuarterForBpm(bpm: number): number {
  return Math.round(60_000_000 / bpm);
}

function conductorMetas(bytes: Uint8Array) {
  return conductorTempoAndMeterMetasFromTrack(firstTrackPayload(bytes));
}

/** One empty measure — no chords, no notes (minimal material). */
function buildMinimalEmptySong(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-6.7 minimal empty',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: fixedId('10000000-0000-4000-8000', 1),
        chords: [],
        notes: [[], [], [], []],
      },
    ],
    bandConfig: DEFAULT_BAND,
  };
}

/** 120 BPM M0 → 90 at M1 → 72 at M2 (three distinct tempo map entries). */
function buildSongWithSequentialTempoChangesAtM1AndM2(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-6.7 sequential tempo',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: fixedId('10000000-0000-4000-8000', 10),
        chords: [],
        notes: [[], [], [], []],
      },
      {
        id: fixedId('10000000-0000-4000-8000', 11),
        chords: [],
        notes: [[], [], [], []],
        changes: { tempo: 90 },
      },
      {
        id: fixedId('10000000-0000-4000-8000', 12),
        chords: [],
        notes: [[], [], [], []],
        changes: { tempo: 72 },
      },
      {
        id: fixedId('10000000-0000-4000-8000', 13),
        chords: [],
        notes: [[], [], [], []],
      },
    ],
    bandConfig: DEFAULT_BAND,
  };
}

describe('TASK-6.7 MidiExporter — integration (INTERFACES § MidiExporter)', () => {
  const exporter = createMidiExporter();

  describe('createDragBlob — byte parity with exportSong', () => {
    it('wraps the same Uint8Array bytes as exportSong in a Blob (observable SMF identity)', async () => {
      const song = buildMinimalEmptySong();
      const fromExport = exporter.exportSong(song);
      const blob = exporter.createDragBlob(song);
      const fromBlob = new Uint8Array(await blob.arrayBuffer());
      expect(fromBlob).toEqual(fromExport);
    });
  });

  describe('exportSong — minimal / empty musical content', () => {
    it('still emits SMF Type 1 at 480 PPQN with multiple tracks and no note-on spans anywhere', () => {
      const song = buildMinimalEmptySong();
      const bytes = exporter.exportSong(song);
      const header = parseSmfHeader(bytes);
      expect(header.format).toBe(1);
      expect(header.ticksPerQuarter).toBe(480);
      expect(header.numTracks).toBeGreaterThanOrEqual(5);
      expect(tracksWithNoteData(bytes).length).toBe(0);
      expect(ff01EventsInFile(bytes).length).toBe(0);
    });
  });

  describe('exportMelodyOnly vs exportSong — conductor parity (minimal song)', () => {
    it('writes identical FF 51 and FF 58 sequences on the conductor track when there is no melody material', () => {
      const song = buildMinimalEmptySong();
      const full = exporter.exportSong(song);
      const melody = exporter.exportMelodyOnly(song);
      const a = conductorMetas(full);
      const b = conductorMetas(melody);
      expect(a.setTempos).toEqual(b.setTempos);
      expect(a.timeSignatures).toEqual(b.timeSignatures);
    });
  });

  describe('tempo map — sequential mid-score BPM changes', () => {
    it('emits three Set Tempo metas at measure 0, M1, and M2 starts when tempo changes twice after the first measure', () => {
      const song = buildSongWithSequentialTempoChangesAtM1AndM2();
      const starts = getMeasureStartTicks(song);
      expect(getTempoAtMeasure(song, 0)).toBe(120);
      expect(getTempoAtMeasure(song, 1)).toBe(90);
      expect(getTempoAtMeasure(song, 2)).toBe(72);

      const bytes = exporter.exportSong(song);
      const { setTempos } = conductorMetas(bytes);

      const t0 = internalAbsTickToMidiTick(starts[0] ?? 0);
      const t1 = internalAbsTickToMidiTick(starts[1]!);
      const t2 = internalAbsTickToMidiTick(starts[2]!);

      const at0 = setTempos.find((e) => e.absTick === t0);
      const at1 = setTempos.find((e) => e.absTick === t1);
      const at2 = setTempos.find((e) => e.absTick === t2);

      expect(at0?.usecPerQuarter).toBe(expectedUsecPerQuarterForBpm(120));
      expect(at1?.usecPerQuarter).toBe(expectedUsecPerQuarterForBpm(90));
      expect(at2?.usecPerQuarter).toBe(expectedUsecPerQuarterForBpm(72));
    });
  });
});
