/*
 * QA COVERAGE PLAN — TASK-4.8 (loop bar + loop playback)
 *
 * Criterion 1: PlaybackStore loop region uses integer ticks per PAT-004 and only accepts end > start.
 *   happy: valid integer tick bounds enable loop state
 *   error: invalid ranges preserve the previous valid loop region
 *   edge: non-integer ticks are rejected
 *
 * Criterion 2: Loop playback uses PlaybackStore + AudioEngine.setLoop(enabled, startTick?, endTick?).
 *   happy: a stored loop region is pushed to the Tone transport when playback starts
 *
 * Criterion 3: Looping can be disabled again from the public store surface.
 *   happy: disabling loop sets isLooping false and calls AudioEngine.setLoop(false, ...)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPlaybackEngineForTests } from '@/engine/audio';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { resetPlaybackStoreForTests, usePlaybackStore, type PlaybackStore } from '@/store/playbackStore';

const { toneStart, transport } = vi.hoisted(() => ({
  toneStart: vi.fn<[], Promise<void>>(),
  transport: {
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
  },
}));

vi.mock('@/engine/audio/pianoSampleLoader', () => ({
  ensurePianoSamplesLoaded: vi.fn(() => Promise.resolve()),
  disposePianoSamples: vi.fn(),
  resetPianoSampleCacheForTests: vi.fn(),
  getPianoInstrument: vi.fn(() => null),
}));

vi.mock('tone', () => ({
  __esModule: true,
  start: () => toneStart(),
  getContext: () => ({
    rawContext: {},
  }),
  getTransport: () => transport,
}));

type LoopDisableApi = PlaybackStore &
  Partial<{
    clearLoop: () => void;
    disableLoop: () => void;
    setLoopEnabled: (enabled: boolean) => void;
  }>;

function polyfillRaf(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number;
  }
  if (typeof globalThis.cancelAnimationFrame !== 'function') {
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }
}

function resetTransport(): void {
  transport.bpm.value = 120;
  transport.ticks = 0;
  transport.loop = false;
  transport.loopStart = 0;
  transport.loopEnd = 0;
}

function getDisableLoopAction(state: LoopDisableApi): (() => void) | null {
  if (typeof state.clearLoop === 'function') {
    return () => state.clearLoop!();
  }
  if (typeof state.disableLoop === 'function') {
    return () => state.disableLoop!();
  }
  if (typeof state.setLoopEnabled === 'function') {
    return () => state.setLoopEnabled!(false);
  }
  return null;
}

describe('PlaybackStore — TASK-4.8 — loop region contract', () => {
  beforeEach(() => {
    polyfillRaf();
    vi.clearAllMocks();
    resetTransport();
    toneStart.mockResolvedValue(undefined);
    resetPlaybackEngineForTests();
    resetPlaybackStoreForTests();
    useSongStore.getState().loadSong(buildDefaultSong());
  });

  afterEach(() => {
    resetPlaybackStoreForTests();
    resetPlaybackEngineForTests();
  });

  describe('happy path', () => {
    it('stores a valid integer loop region in ticks and marks looping enabled', () => {
      usePlaybackStore.getState().setLoop(48, 192);

      const state = usePlaybackStore.getState();
      expect(state.isLooping).toBe(true);
      expect(state.loopStart).toBe(48);
      expect(state.loopEnd).toBe(192);
    });

    it('applies the stored loop region to Tone transport when playback starts', async () => {
      usePlaybackStore.getState().setLoop(48, 192);

      await usePlaybackStore.getState().initializeAudio();
      usePlaybackStore.getState().play();

      expect(transport.loop).toBe(true);
      expect(transport.loopStart).toBe(48);
      expect(transport.loopEnd).toBe(192);
      expect(transport.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('rejects loop ranges where endTick is not greater than startTick and preserves the prior valid region', () => {
      usePlaybackStore.getState().setLoop(48, 192);

      usePlaybackStore.getState().setLoop(192, 192);

      const state = usePlaybackStore.getState();
      expect(state.isLooping).toBe(true);
      expect(state.loopStart).toBe(48);
      expect(state.loopEnd).toBe(192);
    });
  });

  describe('edge cases', () => {
    it('rejects non-integer tick inputs so loop bounds remain PAT-004 integer ticks', () => {
      usePlaybackStore.getState().setLoop(48, 192);

      usePlaybackStore.getState().setLoop(12.5, 96);

      const state = usePlaybackStore.getState();
      expect(state.loopStart).toBe(48);
      expect(state.loopEnd).toBe(192);
    });

    it('exposes a public disable-loop action and syncs AudioEngine.setLoop(false, ...)', async () => {
      await usePlaybackStore.getState().initializeAudio();
      usePlaybackStore.getState().setLoop(48, 192);

      const disableLoop = getDisableLoopAction(usePlaybackStore.getState() as LoopDisableApi);
      if (!disableLoop) {
        throw new Error(
          'Expected PlaybackStore to expose a public disable-loop action such as clearLoop(), disableLoop(), or setLoopEnabled(false).',
        );
      }

      disableLoop();

      const state = usePlaybackStore.getState();
      expect(state.isLooping).toBe(false);
      expect(transport.loop).toBe(false);
    });
  });
});
