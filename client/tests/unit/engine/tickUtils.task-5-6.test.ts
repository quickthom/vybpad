/**
 * TASK-5.6 — tempo map + measure lengths with `MeasureChanges` (PAT-004).
 */
import type { SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  getMeasureStartTicks,
  getTempoAtMeasure,
  measureIndexFromAbsoluteTick,
  measureLengthInTicks,
} from '../../../src/engine/renderer/tickUtils';

function minimalSong(overrides: Partial<SongData> = {}): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'T',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      { id: 'a', chords: [], notes: [[], [], [], []], changes: undefined },
      { id: 'b', chords: [], notes: [[], [], [], []], changes: undefined },
      { id: 'c', chords: [], notes: [[], [], [], []], changes: undefined },
    ],
    bandConfig: {
      tracks: [
        { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
        { role: 'melody2', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
        { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
        { role: 'drums', instrument: 'piano', volume: 0, mute: true, octave: 0 },
      ],
    },
    ...overrides,
  };
}

describe('TASK-5.6 getTempoAtMeasure', () => {
  it('inherits metadata.tempo until a measure sets changes.tempo', () => {
    const song = minimalSong();
    song.measures[1]!.changes = { tempo: 90 };
    expect(getTempoAtMeasure(song, 0)).toBe(120);
    expect(getTempoAtMeasure(song, 1)).toBe(90);
    expect(getTempoAtMeasure(song, 2)).toBe(90);
  });

  it('applies later measure tempo overrides forward', () => {
    const song = minimalSong();
    song.measures[1]!.changes = { tempo: 90 };
    song.measures[2]!.changes = { tempo: 200 };
    expect(getTempoAtMeasure(song, 2)).toBe(200);
  });
});

describe('TASK-5.6 meter lengths (PAT-004)', () => {
  it('extends measure tick map when meter changes mid-score', () => {
    const song = minimalSong();
    // M0: 4/4 → 192 ticks; M1: 3/4 at start of M1 → 144 ticks; M2: inherits 3/4
    song.measures[1]!.changes = { meter: { numerator: 3, denominator: 4 } };
    const starts = getMeasureStartTicks(song);
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBe(192);
    expect(starts[2]).toBe(192 + 144);
    expect(starts[3]).toBe(192 + 144 + 144);
    expect(measureLengthInTicks({ numerator: 3, denominator: 4 })).toBe(144);
  });
});

describe('TASK-5.6 measureIndexFromAbsoluteTick', () => {
  it('maps absolute ticks to the measure containing that timeline position', () => {
    const song = minimalSong();
    song.measures[1]!.changes = { meter: { numerator: 3, denominator: 4 } };
    expect(measureIndexFromAbsoluteTick(song, 0)).toBe(0);
    expect(measureIndexFromAbsoluteTick(song, 191)).toBe(0);
    expect(measureIndexFromAbsoluteTick(song, 192)).toBe(1);
    expect(measureIndexFromAbsoluteTick(song, 192 + 143)).toBe(1);
    expect(measureIndexFromAbsoluteTick(song, 192 + 144)).toBe(2);
  });
});
