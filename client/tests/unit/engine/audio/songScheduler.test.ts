import { describe, expect, it } from 'vitest';

import { buildScheduledPlayEvents } from '@/engine/audio/songScheduler';
import { theoryEngine } from '@/engine/theory/theoryEngine';

import type { SongData } from '@vybpad/shared';

function minimalSong(overrides: Partial<SongData> = {}): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 't',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: 'm0',
        chords: [],
        notes: [
          [
            {
              id: 'n1',
              scaleDegree: 1,
              octave: 0,
              chromatic: 0,
              beat: 0,
              duration: 48,
              isRest: false,
              velocity: 100,
            },
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
    ...overrides,
  };
}

describe('songScheduler — buildScheduledPlayEvents', () => {
  it('places melody1 at absolute tick 0 with duration 48 TPQN', () => {
    const song = minimalSong();
    const evs = buildScheduledPlayEvents(song, theoryEngine);
    const melody = evs.filter((e) => e.role === 'melody1');
    expect(melody).toHaveLength(1);
    expect(melody[0].tick).toBe(0);
    expect(melody[0].durationTicks).toBe(48);
    expect(melody[0].midi).toBe(60);
  });

  it('offsets melody by cumulative measure length (two 4/4 bars → second measure starts at 192 ticks)', () => {
    const song = minimalSong({
      measures: [
        minimalSong().measures[0],
        {
          id: 'm1',
          chords: [],
          notes: [
            [
              {
                id: 'n2',
                scaleDegree: 2,
                octave: 0,
                chromatic: 0,
                beat: 0,
                duration: 24,
                isRest: false,
                velocity: 100,
              },
            ],
            [],
            [],
            [],
          ],
        },
      ],
    });
    const evs = buildScheduledPlayEvents(song, theoryEngine);
    const m2 = evs.find((e) => e.role === 'melody1' && e.tick >= 192);
    expect(m2).toBeDefined();
    expect(m2!.tick).toBe(192);
  });
});
