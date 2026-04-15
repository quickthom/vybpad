/*
 * QA COVERAGE PLAN — Task 6.3 (tempo map + meter map in conductor track)
 * ───────────────────────────────────────────────────────────────────────
 * 1. Regression: constant tempo/meter — SMF1/480, tracks, chord FF01, note scaling (6.1/6.2 parity).
 * 2. Tempo change at M>0 — FF 51 at measure boundary matches getTempoAtMeasure; tick from getMeasureStartTicks.
 * 3. Meter change — FF 58 matches getMeterAtMeasure for each span at correct ticks.
 * 4. Parity — exportSong vs exportMelodyOnly: same FF51/FF58 sequence on conductor (track 0).
 */

import { createMidiExporter, MIDI_TICK_SCALE } from '@/engine/midi';
import {
  getMeasureStartTicks,
  getMeterAtMeasure,
  getTempoAtMeasure,
} from '@/engine/renderer/tickUtils';
import type { ChordEvent, NoteEvent, SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  conductorTempoAndMeterMetasFromTrack,
  ff01EventsInFile,
  firstTrackPayload,
  listMTrkPayloads,
  noteSpansFromTrack,
  parseSmfHeader,
  tracksWithNoteData,
} from '../../../helpers/smfTestUtils';

const MIDI_EXPLICIT_TICK_PAD = 1;

function fixedId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(12, '0')}`;
}

function internalAbsTickToMidiTick(absInternal: number): number {
  return absInternal * MIDI_TICK_SCALE + MIDI_EXPLICIT_TICK_PAD;
}

/** midi-writer-js TempoEvent uses Math.round(60_000_000 / bpm). */
function expectedUsecPerQuarterForBpm(bpm: number): number {
  return Math.round(60_000_000 / bpm);
}

const DEFAULT_BAND = {
  tracks: [
    { role: 'melody1' as const, instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
    { role: 'melody2' as const, instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
    { role: 'melody3' as const, instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
    { role: 'melody4' as const, instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
    { role: 'harmony' as const, instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
    { role: 'bass' as const, instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
    { role: 'drums' as const, instrument: 'piano', volume: 0.0, mute: true, octave: 0 },
  ],
};

/** Constant 4/4 + 120 BPM: melody quarter + harmony chord (TASK-6.1/6.2 regression baseline). */
function buildConstantSongWithMelodyHarmonyAndTwoChords(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-6.3 regression constant',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: fixedId('10000000-0000-4000-8000', 1),
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
            duration: 96,
          } satisfies ChordEvent,
          {
            id: fixedId('20000000-0000-4000-8000', 2),
            scaleDegree: 5,
            quality: 'major',
            seventh: 'dom7',
            suspension: 'none',
            addition: 'none',
            inversion: 0,
            borrowed: null,
            secondary: null,
            beat: 96,
            duration: 96,
          } satisfies ChordEvent,
        ],
        notes: [
          [
            {
              id: fixedId('30000000-0000-4000-8000', 1),
              scaleDegree: 1,
              octave: 0,
              chromatic: 0,
              beat: 0,
              duration: 48,
              isRest: false,
              velocity: 100,
            } satisfies NoteEvent,
          ],
          [],
          [],
          [],
        ],
      },
    ],
    bandConfig: DEFAULT_BAND,
  };
}

/** Tempo 120 in metadata; first change to 90 BPM at start of measure index 1. */
function buildSongWithTempoChangeAtMeasureOne(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-6.3 tempo change M1',
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
      {
        id: fixedId('10000000-0000-4000-8000', 2),
        chords: [],
        notes: [[], [], [], []],
        changes: { tempo: 90 },
      },
      {
        id: fixedId('10000000-0000-4000-8000', 3),
        chords: [],
        notes: [[], [], [], []],
      },
    ],
    bandConfig: DEFAULT_BAND,
  };
}

/** 4/4 then 3/4 from measure index 1 (TASK-5.6 fixture). */
function buildSongWithMeterChangeAtMeasureOne(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-6.3 meter change M1',
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
        changes: { meter: { numerator: 3, denominator: 4 } },
      },
      {
        id: fixedId('10000000-0000-4000-8000', 12),
        chords: [],
        notes: [[], [], [], []],
      },
    ],
    bandConfig: DEFAULT_BAND,
  };
}

/** Combined tempo + meter changes for exportSong vs exportMelodyOnly parity. */
function buildSongWithTempoAndMeterChanges(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-6.3 tempo+meter',
      key: 'C',
      scale: 'major',
      tempo: 100,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: fixedId('10000000-0000-4000-8000', 20),
        chords: [],
        notes: [[], [], [], []],
      },
      {
        id: fixedId('10000000-0000-4000-8000', 21),
        chords: [],
        notes: [[], [], [], []],
        changes: { tempo: 140, meter: { numerator: 6, denominator: 8 } },
      },
    ],
    bandConfig: DEFAULT_BAND,
  };
}

function conductorMetas(bytes: Uint8Array) {
  return conductorTempoAndMeterMetasFromTrack(firstTrackPayload(bytes));
}

describe('TASK-6.3 MidiExporter — tempo/meter map (INTERFACES § MidiExporter, tickUtils)', () => {
  const exporter = createMidiExporter();

  describe('regression — constant tempo/meter preserves TASK-6.1/6.2-level SMF output', () => {
    it('exports SMF Type 1 at 480 PPQN with multiple note tracks and PAT-004 quarter = 480 MIDI ticks', () => {
      const song = buildConstantSongWithMelodyHarmonyAndTwoChords();
      const bytes = exporter.exportSong(song);
      const header = parseSmfHeader(bytes);
      expect(header.format).toBe(1);
      expect(header.ticksPerQuarter).toBe(480);
      expect(tracksWithNoteData(bytes).length).toBeGreaterThanOrEqual(2);

      let found480 = false;
      for (const tr of listMTrkPayloads(bytes)) {
        for (const s of noteSpansFromTrack(tr)) {
          if (s.endTick - s.startTick === 480) found480 = true;
        }
      }
      expect(found480).toBe(true);
    });

    it('places chord-name FF 01 events at PAT-004–scaled ticks (same rule as TASK-6.2)', () => {
      const song = buildConstantSongWithMelodyHarmonyAndTwoChords();
      const bytes = exporter.exportSong(song);
      const ticks = ff01EventsInFile(bytes).map((e) => e.absTick);
      expect(ticks).toContain(internalAbsTickToMidiTick(0));
      expect(ticks).toContain(internalAbsTickToMidiTick(96));
    });

    it('exportMelodyOnly yields exactly one MTrk with note spans', () => {
      const song = buildConstantSongWithMelodyHarmonyAndTwoChords();
      const bytes = exporter.exportMelodyOnly(song);
      parseSmfHeader(bytes);
      expect(tracksWithNoteData(bytes).length).toBe(1);
    });
  });

  describe('tempo change — FF 51 on conductor track at measure boundaries', () => {
    it('emits Set Tempo for post-change BPM at the MIDI tick aligned to getMeasureStartTicks for that measure', () => {
      const song = buildSongWithTempoChangeAtMeasureOne();
      const starts = getMeasureStartTicks(song);
      const boundaryInternal = starts[1]!;
      const boundaryMidi = internalAbsTickToMidiTick(boundaryInternal);
      expect(getTempoAtMeasure(song, 0)).toBe(120);
      expect(getTempoAtMeasure(song, 1)).toBe(90);

      const bytes = exporter.exportSong(song);
      const { setTempos } = conductorMetas(bytes);
      const atBoundary = setTempos.find((e) => e.absTick === boundaryMidi);
      expect(atBoundary).toBeDefined();
      expect(atBoundary!.usecPerQuarter).toBe(expectedUsecPerQuarterForBpm(getTempoAtMeasure(song, 1)));

      const initial = setTempos.find((e) => e.absTick === internalAbsTickToMidiTick(0));
      expect(initial).toBeDefined();
      expect(initial!.usecPerQuarter).toBe(expectedUsecPerQuarterForBpm(getTempoAtMeasure(song, 0)));
    });
  });

  describe('meter change — FF 58 matches getMeterAtMeasure for each span', () => {
    it('emits Time Signature meta at the MIDI tick aligned to each measure start where the notated meter applies', () => {
      const song = buildSongWithMeterChangeAtMeasureOne();
      const starts = getMeasureStartTicks(song);
      const m0 = getMeterAtMeasure(song, 0);
      const m1 = getMeterAtMeasure(song, 1);
      expect(m0).toEqual({ numerator: 4, denominator: 4 });
      expect(m1).toEqual({ numerator: 3, denominator: 4 });

      const bytes = exporter.exportSong(song);
      const { timeSignatures } = conductorMetas(bytes);
      const t0 = timeSignatures.find((e) => e.absTick === internalAbsTickToMidiTick(starts[0] ?? 0));
      expect(t0).toBeDefined();
      expect(t0!.numerator).toBe(m0.numerator);
      expect(t0!.denominator).toBe(m0.denominator);

      const tM1 = timeSignatures.find((e) => e.absTick === internalAbsTickToMidiTick(starts[1]!));
      expect(tM1).toBeDefined();
      expect(tM1!.numerator).toBe(m1.numerator);
      expect(tM1!.denominator).toBe(m1.denominator);
    });
  });

  describe('parity — exportMelodyOnly vs exportSong conductor tempo/meter map', () => {
    it('writes identical FF 51 and FF 58 sequences on track 0 for the same song (including mid-score map events)', () => {
      const song = buildSongWithTempoAndMeterChanges();
      const full = exporter.exportSong(song);
      const melody = exporter.exportMelodyOnly(song);

      const a = conductorMetas(full);
      const b = conductorMetas(melody);

      expect(a.setTempos.length).toBeGreaterThanOrEqual(2);
      expect(a.timeSignatures.length).toBeGreaterThanOrEqual(2);
      expect(b.setTempos.length).toBeGreaterThanOrEqual(2);
      expect(b.timeSignatures.length).toBeGreaterThanOrEqual(2);

      expect(a.setTempos).toEqual(b.setTempos);
      expect(a.timeSignatures).toEqual(b.timeSignatures);
    });
  });
});
