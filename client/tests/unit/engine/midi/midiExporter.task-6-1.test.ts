/*
 * QA COVERAGE PLAN — Task 6.1 (MIDI Type 1 export)
 * ───────────────────────────────────────────────
 * Criterion 1: exportSong → Uint8Array valid SMF Type 1, 480 PPQN
 *   happy: parse header format=1, division=480, MTrk chunks present
 *   error: N/A (contract returns bytes)
 *   edges: N/A for MVP
 *
 * Criterion 2: multiple tracks with note data (melody + harmony voicings)
 *   happy: ≥2 distinct MTrk payloads contain note spans
 *   error: N/A
 *   edges: N/A
 *
 * Criterion 3: PAT-004 tick scaling (internal ×10 → MIDI at 480 PPQN)
 *   happy: quarter-note melody (48 internal ticks) → 480 ticks between on/off
 *   error: N/A
 *   edges: N/A
 *
 * Criterion 4: exportMelodyOnly → valid single-melody MIDI
 *   happy: header parses; exactly one track has note spans (conductor-only tempo is OK)
 *   error: N/A
 *   edges: optional voice index selects non-default voice
 *
 * Criterion 5: createDragBlob → Blob with MIDI MIME
 *   happy: type matches audio/midi (or equivalent)
 *   error: N/A
 *
 * Criterion 6: do not assert FF 01 chord names (6.2) or full tempo-map behavior (6.3)
 */

import { createMidiExporter } from '@/engine/midi';
import type { ChordEvent, NoteEvent, SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  listMTrkPayloads,
  noteSpansFromTrack,
  parseSmfHeader,
  tracksWithNoteData,
} from '../../../helpers/smfTestUtils';

function fixedId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(12, '0')}`;
}

/** One measure: harmony chord + melody quarter note (48 ticks) for scaling checks. */
function buildMelodyAndHarmonySong(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-6.1 melody+harmony',
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
            duration: 192,
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

/** Melody on voice index 1 only — for `exportMelodyOnly(song, 1)`. */
function buildSongWithMelodyOnVoice1(): SongData {
  const base = buildMelodyAndHarmonySong();
  const m0 = base.measures[0]!;
  return {
    ...base,
    measures: [
      {
        ...m0,
        notes: [
          [],
          [
            {
              id: fixedId('31000000-0000-4000-8000', 1),
              scaleDegree: 2,
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
        ],
      },
    ],
  };
}

describe('TASK-6.1 MidiExporter — acceptance criteria (INTERFACES § MidiExporter)', () => {
  const exporter = createMidiExporter();

  describe('exportSong — SMF Type 1 and 480 PPQN', () => {
    it('returns a Uint8Array that is a valid SMF with format type 1 and 480 ticks per quarter', () => {
      const song = buildMelodyAndHarmonySong();
      const bytes = exporter.exportSong(song);
      expect(bytes).toBeInstanceOf(Uint8Array);
      const header = parseSmfHeader(bytes);
      expect(header.format).toBe(1);
      expect(header.ticksPerQuarter).toBe(480);
    });
  });

  describe('exportSong — melody + harmony tracks with note data', () => {
    it('writes at least two MTrk chunks that contain note on/off spans (melody and harmony)', () => {
      const song = buildMelodyAndHarmonySong();
      const bytes = exporter.exportSong(song);
      const withNotes = tracksWithNoteData(bytes);
      expect(withNotes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('exportSong — PAT-004 tick scaling (×10 to 480 PPQN)', () => {
    it('maps internal 48-tick quarter note to 480 MIDI ticks between note on and note off on the melody track', () => {
      const song = buildMelodyAndHarmonySong();
      const bytes = exporter.exportSong(song);
      const tracks = listMTrkPayloads(bytes);
      const header = parseSmfHeader(bytes);
      expect(header.ticksPerQuarter).toBe(480);

      let found480 = false;
      for (const tr of tracks) {
        const spans = noteSpansFromTrack(tr);
        for (const s of spans) {
          const dur = s.endTick - s.startTick;
          if (dur === 480) {
            found480 = true;
          }
        }
      }
      expect(found480).toBe(true);
    });
  });

  describe('exportMelodyOnly — single melody MIDI', () => {
    it('returns a valid SMF where only one track carries note data (melody line only)', () => {
      const song = buildMelodyAndHarmonySong();
      const bytes = exporter.exportMelodyOnly(song);
      expect(bytes).toBeInstanceOf(Uint8Array);
      parseSmfHeader(bytes);
      const idx = tracksWithNoteData(bytes);
      expect(idx.length).toBe(1);
    });

    it('when voice is passed, exports that voice’s melody line (non-default voice)', () => {
      const song = buildSongWithMelodyOnVoice1();
      const bytes = exporter.exportMelodyOnly(song, 1);
      expect(bytes).toBeInstanceOf(Uint8Array);
      parseSmfHeader(bytes);
      const idx = tracksWithNoteData(bytes);
      expect(idx.length).toBe(1);
    });
  });

  describe('createDragBlob — MIME type', () => {
    it('returns a Blob with an audio/* MIDI MIME type suitable for DAW drag-and-drop', () => {
      const song = buildMelodyAndHarmonySong();
      const blob = exporter.createDragBlob(song);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type.toLowerCase()).toMatch(/midi/);
    });
  });
});
