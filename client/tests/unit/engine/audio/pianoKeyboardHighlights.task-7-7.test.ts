/**
 * TASK-7.7 — Active MIDI at tick matches scheduler + mute flags.
 */
import {
  buildScheduledPlayEvents,
  collectActiveMidiNotesAtScheduledEvents,
} from '@/engine/audio/songScheduler';
import { theoryEngine } from '@/engine/theory/theoryEngine';
import type { SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

/** Same shape as `songScheduler.test.ts` — one melody quarter on beat 0 (MIDI 60). */
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

describe('piano keyboard highlights — TASK-7.7', () => {
  it('returns MIDI pitches sounding at a scheduler event tick', () => {
    const song = minimalSong();
    const events = buildScheduledPlayEvents(song, theoryEngine);
    expect(events.length).toBeGreaterThan(0);
    const first = events[0];
    const midis = collectActiveMidiNotesAtScheduledEvents(events, song, first.tick);
    expect(midis).toContain(first.midi);
  });

  it('drops muted track notes', () => {
    const song = minimalSong();
    const events = buildScheduledPlayEvents(song, theoryEngine);
    const melody = events.find((e) => e.role === 'melody1');
    expect(melody).toBeDefined();

    const muted: SongData = structuredClone(song);
    muted.bandConfig = {
      ...muted.bandConfig,
      tracks: muted.bandConfig.tracks.map((t) => (t.role === 'melody1' ? { ...t, mute: true } : t)),
    };
    const mutedEvents = buildScheduledPlayEvents(muted, theoryEngine);
    const atTick = collectActiveMidiNotesAtScheduledEvents(mutedEvents, muted, melody!.tick);
    expect(atTick.includes(melody!.midi)).toBe(false);
  });
});
