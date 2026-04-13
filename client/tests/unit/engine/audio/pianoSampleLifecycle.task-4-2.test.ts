/*
 * QA COVERAGE PLAN — 4.2
 *
 * Criterion 1: First Play-init path triggers sample load and transitions init status to ready on success
 *   happy: AudioEngine.initialize() runs lazy piano sample load; PlaybackStore reaches ready
 *   error: —
 *   edges: —
 *
 * Criterion 2: Cache behavior avoids repeated heavy load on subsequent init/play
 *   happy: second initialize() does not construct a second SplendidGrandPiano / reload samples
 *   error: —
 *   edges: —
 *
 * Criterion 3: Failures produce canonical init error code + safe user-facing behavior
 *   happy: getPlaybackInitErrorCode maps SAMPLE_LOAD_FAILED PlaybackError to SAMPLE_LOAD_FAILED
 *   error: —
 *   edges: —
 *
 * Mocks: `tone` (incl. getContext) + `smplr` so tests do not require a real AudioContext or network.
 * Module cache is reset via resetPianoSampleCacheForTests between tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPlaybackEngine,
  getPlaybackInitErrorCode,
  PLAYBACK_ERROR_CODES,
  PlaybackError,
  resetPlaybackEngineForTests,
} from '@/engine/audio';
import { resetPianoSampleCacheForTests } from '@/engine/audio/pianoSampleLoader';
import { resetPlaybackStoreForTests, usePlaybackStore } from '@/store/playbackStore';
import { buildDefaultSong, useSongStore } from '@/store/songStore';

const { toneStart, MockSplendidGrandPiano } = vi.hoisted(() => {
  class MockSplendidGrandPiano {
    static ctorCalls = 0;
    disconnect = vi.fn();
    load: Promise<MockSplendidGrandPiano>;
    constructor(_ctx: AudioContext, _opts: { storage: unknown }) {
      MockSplendidGrandPiano.ctorCalls += 1;
      this.load = Promise.resolve(this);
    }
  }
  return {
    toneStart: vi.fn<[], Promise<void>>(),
    MockSplendidGrandPiano,
  };
});

vi.mock('smplr', () => ({
  CacheStorage: class {
    constructor(_name?: string) {}
  },
  SplendidGrandPiano: MockSplendidGrandPiano,
}));

vi.mock('tone', () => ({
  __esModule: true,
  start: () => toneStart(),
  getContext: () => ({
    rawContext: {
      sampleRate: 44_100,
      decodeAudioData: vi.fn(),
    },
  }),
  getTransport: () => ({
    PPQ: 48,
    bpm: { value: 120 },
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
    ticks: 0,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
  }),
}));

function polyfillRaf(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number;
  }
  if (typeof globalThis.cancelAnimationFrame !== 'function') {
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }
}

describe('Piano sample loading — TASK 4.2 — AudioEngine + PlaybackStore lifecycle', () => {
  beforeEach(() => {
    polyfillRaf();
    vi.clearAllMocks();
    MockSplendidGrandPiano.ctorCalls = 0;
    toneStart.mockResolvedValue(undefined);
    resetPianoSampleCacheForTests();
    resetPlaybackEngineForTests();
    resetPlaybackStoreForTests();
    useSongStore.getState().loadSong(buildDefaultSong());
  });

  afterEach(() => {
    resetPianoSampleCacheForTests();
    resetPlaybackStoreForTests();
    resetPlaybackEngineForTests();
  });

  describe('happy path', () => {
    it('constructs the piano sampler exactly once on the first initialize() before reporting ready', async () => {
      const engine = getPlaybackEngine();
      await engine.initialize();

      expect(engine.isReady()).toBe(true);
      expect(MockSplendidGrandPiano.ctorCalls).toBe(1);
    });

    it('reaches PlaybackStore initStatus ready after initializeAudio completes on first play-init path', async () => {
      await usePlaybackStore.getState().initializeAudio();
      expect(usePlaybackStore.getState().initStatus).toBe('ready');
      expect(MockSplendidGrandPiano.ctorCalls).toBe(1);
    });
  });

  describe('cache / idempotent sample load', () => {
    it('does not construct a second piano sampler when initialize() is called again after success', async () => {
      const engine = getPlaybackEngine();
      await engine.initialize();
      MockSplendidGrandPiano.ctorCalls = 0;

      await engine.initialize();

      expect(MockSplendidGrandPiano.ctorCalls).toBe(0);
    });

    it('does not construct a second piano sampler when initializeAudio runs again while the engine is already ready', async () => {
      await usePlaybackStore.getState().initializeAudio();
      MockSplendidGrandPiano.ctorCalls = 0;
      await usePlaybackStore.getState().initializeAudio();
      expect(MockSplendidGrandPiano.ctorCalls).toBe(0);
    });
  });

  describe('error mapping (INTERFACES PlaybackInitErrorCode)', () => {
    it('exposes SAMPLE_LOAD_FAILED on PLAYBACK_ERROR_CODES for engine-thrown sample failures', () => {
      expect(PLAYBACK_ERROR_CODES).toHaveProperty('SAMPLE_LOAD_FAILED');
    });

    it('maps SAMPLE_LOAD_FAILED PlaybackError to init error code SAMPLE_LOAD_FAILED', () => {
      const err = new PlaybackError(PLAYBACK_ERROR_CODES.SAMPLE_LOAD_FAILED);
      expect(getPlaybackInitErrorCode(err)).toBe('SAMPLE_LOAD_FAILED');
    });
  });
});
