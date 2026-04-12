/**
 * Default empty song per INTERFACES.md — Default Song Factory (PAT-003 UUIDs).
 */
import { randomUUID } from 'node:crypto';

import type { SongData } from '@vybpad/shared';

/** INTERFACES.md — Default Song Factory (8 measures, bandConfig, metadata). */
export function buildDefaultSong(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'Untitled',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: Array.from({ length: 8 }, () => ({
      id: randomUUID(),
      chords: [],
      notes: [[], [], [], []] as SongData['measures'][number]['notes'],
    })),
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
