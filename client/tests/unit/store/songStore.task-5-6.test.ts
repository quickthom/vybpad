/**
 * TASK-5.6 — `setMeasureChanges` tempo/meter validation via mergeMeasureChanges.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { buildDefaultSong, useSongStore } from '../../../src/store/songStore';

describe('TASK-5.6 SongStore setMeasureChanges', () => {
  beforeEach(() => {
    useSongStore.getState().loadSong(buildDefaultSong());
  });

  it('stores tempo and meter on the target measure', () => {
    useSongStore.getState().setMeasureChanges(1, { tempo: 140, meter: { numerator: 3, denominator: 4 } });
    const ch = useSongStore.getState().song.measures[1]!.changes;
    expect(ch?.tempo).toBe(140);
    expect(ch?.meter).toEqual({ numerator: 3, denominator: 4 });
  });

  it('does not overwrite tempo with an out-of-range value', () => {
    useSongStore.getState().setMeasureChanges(0, { tempo: 100 });
    useSongStore.getState().setMeasureChanges(0, { tempo: 400 });
    expect(useSongStore.getState().song.measures[0]!.changes?.tempo).toBe(100);
  });

  it('does not overwrite meter with an invalid signature', () => {
    useSongStore.getState().setMeasureChanges(0, { meter: { numerator: 4, denominator: 4 } });
    useSongStore.getState().setMeasureChanges(0, { meter: { numerator: 4, denominator: 3 } });
    expect(useSongStore.getState().song.measures[0]!.changes?.meter).toEqual({
      numerator: 4,
      denominator: 4,
    });
  });
});
