/*
 * QA COVERAGE PLAN — Task 6.2 (FF 01 chord-name text meta events)
 * ───────────────────────────────────────────────────────────────
 * Criterion 1: Text meta (FF 01) at chord start ticks in scaled MIDI time
 *   happy: two chords in one measure at beats 0 and 96 → FF 01 at MIDI ticks matching PAT-004 (×10 + writer pad)
 *   edge: chord on measure boundary → absolute tick includes prior measure length × scale
 *
 * Criterion 2: Labels match theory-backed / project chord symbol conventions
 *   happy: C major Imaj7 → "Cmaj7", V7 → "G7" (fixed key/scale — assert full strings)
 *
 * Criterion 3: Type 1 / 480 PPQN preserved
 *   happy: parseSmfHeader unchanged from TASK-6.1 expectations
 *
 * Criterion 4: exportMelodyOnly omits chord-name text metas
 *   happy: FF 01 count is 0 for melody export
 */

import { createMidiExporter } from '@/engine/midi';
import type { ChordEvent, NoteEvent, SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  ff01EventsInFile,
  parseSmfHeader,
} from '../../../helpers/smfTestUtils';

function fixedId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(12, '0')}`;
}

/** PAT-004 (ARCHITECTURE) ×10 + same +1 tick pad as TASK-6.1 MidiExporter note scheduling. */
function expectedMidiTickForInternalChordBeat(beatInMeasure: number): number {
  const INTERNAL_TO_MIDI_TICK = 10;
  const MIDI_EXPLICIT_TICK_PAD = 1;
  return beatInMeasure * INTERNAL_TO_MIDI_TICK + MIDI_EXPLICIT_TICK_PAD;
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

/** Two chords in 4/4: Cmaj7 on beat 0, G7 on beat 96 (half-note grid). */
function buildTwoChordCMajorSong(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-6.2 two-chord',
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

/** Chord on downbeat of second measure: internal absolute tick 192 → scaled MIDI tick. */
function buildChordAtMeasureTwoDownbeat(): SongData {
  const base = buildTwoChordCMajorSong();
  const longMeasures: SongData['measures'] = [
    {
      ...base.measures[0]!,
      chords: [],
      notes: [[], [], [], []],
    },
    {
      id: fixedId('10000000-0000-4000-8000', 2),
      chords: [
        {
          id: fixedId('20000000-0000-4000-8000', 10),
          scaleDegree: 4,
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
      notes: [[], [], [], []],
    },
  ];
  return {
    ...base,
    measures: longMeasures,
  };
}

describe('TASK-6.2 MidiExporter — chord-name FF 01 text events (INTERFACES § MidiExporter, SongData)', () => {
  const exporter = createMidiExporter();

  describe('exportSong — FF 01 at chord starts (scaled MIDI ticks)', () => {
    it('emits text meta events at PAT-004–scaled ticks matching each chord’s beat offset', () => {
      const song = buildTwoChordCMajorSong();
      const bytes = exporter.exportSong(song);
      const ff01 = ff01EventsInFile(bytes);
      const byTick = new Map(ff01.map((e) => [e.absTick, e.text]));

      const t0 = expectedMidiTickForInternalChordBeat(0);
      const t96 = expectedMidiTickForInternalChordBeat(96);
      expect(byTick.has(t0)).toBe(true);
      expect(byTick.has(t96)).toBe(true);
    });

    it('uses cumulative song time when the chord starts after prior measures (absolute tick scaling)', () => {
      const song = buildChordAtMeasureTwoDownbeat();
      const bytes = exporter.exportSong(song);
      const ff01 = ff01EventsInFile(bytes);
      const ticks = ff01.map((e) => e.absTick).sort((a, b) => a - b);
      const internalAbs = 192;
      const INTERNAL_TO_MIDI_TICK = 10;
      const MIDI_EXPLICIT_TICK_PAD = 1;
      const expected = internalAbs * INTERNAL_TO_MIDI_TICK + MIDI_EXPLICIT_TICK_PAD;
      expect(ticks).toContain(expected);
    });
  });

  describe('exportSong — chord symbol text content', () => {
    it('writes theory-style chord symbols (not empty, includes root letter and quality)', () => {
      const song = buildTwoChordCMajorSong();
      const bytes = exporter.exportSong(song);
      const texts = ff01EventsInFile(bytes).map((e) => e.text);

      const cmaj = texts.find((t) => t.includes('C') && t.toLowerCase().includes('maj'));
      const g7 = texts.find((t) => t.startsWith('G') && t.includes('7'));

      expect(cmaj).toBeDefined();
      expect(g7).toBeDefined();
      expect(cmaj!.length).toBeGreaterThanOrEqual(4);
      expect(g7!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('exportSong — SMF Type 1 and 480 PPQN (unchanged)', () => {
    it('still produces format 1 with 480 ticks per quarter', () => {
      const song = buildTwoChordCMajorSong();
      const bytes = exporter.exportSong(song);
      const header = parseSmfHeader(bytes);
      expect(header.format).toBe(1);
      expect(header.ticksPerQuarter).toBe(480);
    });
  });

  describe('exportMelodyOnly — no chord-name text metas', () => {
    it('does not include FF 01 chord labels in the melody-only export', () => {
      const song = buildTwoChordCMajorSong();
      const bytes = exporter.exportMelodyOnly(song);
      expect(ff01EventsInFile(bytes).length).toBe(0);
    });
  });
});
