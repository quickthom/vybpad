/*
 * QA COVERAGE PLAN — UI-W8 — INTERFACES PlaybackStore (metronome + record arm)
 *
 * RA-13/14: metronomeEnabled + recordArmed with setters; defaults safe for transport wiring.
 *   happy: defaults false; setters update boolean fields
 *   error: —
 *   edges: idempotent toggles
 *
 * Implementation may land after this test file; assertions use INTERFACES-shaped casts.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetPlaybackEngineForTests } from '@/engine/audio';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { resetPlaybackStoreForTests, usePlaybackStore } from '@/store/playbackStore';

/** INTERFACES.md PlaybackStore — UI-W8 slice (store implementation pending). */
type PlaybackStoreUiW8 = {
  metronomeEnabled: boolean;
  recordArmed: boolean;
  setMetronomeEnabled: (enabled: boolean) => void;
  setRecordArmed: (armed: boolean) => void;
};

function playbackW8(): PlaybackStoreUiW8 {
  return usePlaybackStore.getState() as unknown as PlaybackStoreUiW8;
}

describe('PlaybackStore — UI-W8 — metronomeEnabled + recordArmed (INTERFACES)', () => {
  beforeEach(() => {
    resetPlaybackEngineForTests();
    resetPlaybackStoreForTests();
    useSongStore.getState().loadSong(buildDefaultSong());
  });

  afterEach(() => {
    resetPlaybackEngineForTests();
    resetPlaybackStoreForTests();
  });

  describe('happy path', () => {
    it('defaults metronomeEnabled and recordArmed to false', () => {
      const s = playbackW8();
      expect(s.metronomeEnabled).toBe(false);
      expect(s.recordArmed).toBe(false);
    });

    it('sets metronomeEnabled via setMetronomeEnabled and recordArmed via setRecordArmed', () => {
      playbackW8().setMetronomeEnabled(true);
      expect(playbackW8().metronomeEnabled).toBe(true);

      playbackW8().setRecordArmed(true);
      expect(playbackW8().recordArmed).toBe(true);

      playbackW8().setMetronomeEnabled(false);
      playbackW8().setRecordArmed(false);
      expect(playbackW8().metronomeEnabled).toBe(false);
      expect(playbackW8().recordArmed).toBe(false);
    });
  });
});
