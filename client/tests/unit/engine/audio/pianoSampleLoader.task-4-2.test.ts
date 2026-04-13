/*
 * QA — TASK-4.2: lazy piano sample load + cache (smplr + CacheStorage).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const counters = vi.hoisted(() => ({ splendidCtorCalls: 0 }));

vi.mock('tone', () => ({
  __esModule: true,
  getContext: () => ({
    rawContext: { destination: {} },
  }),
}));

vi.mock('smplr', () => {
  class MockPiano {
    readonly load: Promise<this>;
    constructor() {
      counters.splendidCtorCalls += 1;
      this.load = Promise.resolve(this);
    }
    disconnect(): void {}
  }
  return {
    CacheStorage: class MockCache {
      constructor(_name?: string) {}
    },
    SplendidGrandPiano: MockPiano,
  };
});

import {
  disposePianoSamples,
  ensurePianoSamplesLoaded,
} from '@/engine/audio/pianoSampleLoader';
import {
  getPlaybackInitErrorCode,
  PLAYBACK_ERROR_CODES,
  PlaybackError,
} from '@/engine/audio/playbackErrors';

describe('pianoSampleLoader — TASK-4.2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    counters.splendidCtorCalls = 0;
    disposePianoSamples();
  });

  afterEach(() => {
    disposePianoSamples();
  });

  it('loads once on first ensurePianoSamplesLoaded and reuses cache on subsequent calls', async () => {
    await ensurePianoSamplesLoaded();
    await ensurePianoSamplesLoaded();
    await ensurePianoSamplesLoaded();

    expect(counters.splendidCtorCalls).toBe(1);
  });

  it('maps sample load failures to SAMPLE_LOAD_FAILED init code (PAT-001)', () => {
    const err = new PlaybackError(PLAYBACK_ERROR_CODES.SAMPLE_LOAD_FAILED);
    expect(getPlaybackInitErrorCode(err)).toBe('SAMPLE_LOAD_FAILED');
  });
});
