/**
 * TASK-1B.4 — Default Song Factory (INTERFACES.md), PAT-014.
 */
import { describe, it, expect } from 'vitest';

import { buildDefaultSong } from '../src/services/defaultSongFactory.js';

/** RFC 4122 UUID v4 (Node crypto.randomUUID). */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('defaultSongFactory — buildDefaultSong', () => {
  it('returns SongData matching INTERFACES Default Song Factory (8 measures, bandConfig, metadata)', () => {
    const song = buildDefaultSong();
    expect(song.version).toBe('1.0');
    expect(song.metadata).toEqual({
      title: 'Untitled',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    });
    expect(song.measures).toHaveLength(8);
    for (const m of song.measures) {
      expect(m.id).toMatch(UUID_V4);
      expect(m.chords).toEqual([]);
      expect(m.notes).toEqual([[], [], [], []]);
    }
    expect(song.bandConfig.tracks).toHaveLength(7);
    expect(song.bandConfig.tracks.map((t) => t.role)).toEqual([
      'melody1',
      'melody2',
      'melody3',
      'melody4',
      'harmony',
      'bass',
      'drums',
    ]);
  });

  it('generates distinct measure ids on each call', () => {
    const a = buildDefaultSong();
    const b = buildDefaultSong();
    const idsA = new Set(a.measures.map((m) => m.id));
    const idsB = new Set(b.measures.map((m) => m.id));
    expect(idsA.size).toBe(8);
    expect(idsB.size).toBe(8);
    expect(idsA).not.toEqual(idsB);
  });
});
