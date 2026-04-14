import type { NoteEvent, SongData, Viewport } from '@vybpad/shared';
import { randomUUID } from 'node:crypto';

import {
  computeNoteBlockRect,
  VOICE_LANE_Y_OFFSET_PX,
  voiceLaneOffsetY,
} from '../../../../src/engine/renderer/noteBlocks';
import { describe, expect, it } from 'vitest';

function minimalSong(note: NoteEvent, voice: 0 | 1 | 2 | 3): SongData {
  const notes: [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]] = [[], [], [], []];
  notes[voice] = [note];
  return {
    version: '1.0',
    metadata: {
      title: 'T',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
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
    measures: [{ id: randomUUID(), chords: [], notes }],
  };
}

describe('noteBlocks — TASK-5.7 voice lane offsets', () => {
  it('voiceLaneOffsetY scales linearly with voice index', () => {
    expect(voiceLaneOffsetY(0)).toBe(0);
    expect(voiceLaneOffsetY(3)).toBeCloseTo(3 * VOICE_LANE_Y_OFFSET_PX, 5);
  });

  it('computeNoteBlockRect shifts Y by voiceLaneOffsetY vs voice 0 for the same pitch', () => {
    const n: NoteEvent = {
      id: 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee',
      scaleDegree: 4,
      octave: 0,
      chromatic: 0,
      beat: 24,
      duration: 48,
      isRest: false,
      velocity: 100,
    };
    const song = minimalSong(n, 0);
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const base = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: n,
      isRest: false,
      voiceIndex: 0,
    });
    const v3 = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: n,
      isRest: false,
      voiceIndex: 3,
    });
    expect(v3.y - base.y).toBeCloseTo(voiceLaneOffsetY(3), 5);
  });
});
