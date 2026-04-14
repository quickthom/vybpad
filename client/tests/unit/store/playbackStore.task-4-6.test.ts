/*
 * QA COVERAGE PLAN — TASK-4.6 (playback cursor wiring)
 *
 * INTERFACES.md — EditorCanvas.playbackTick: "null when stopped; absolute tick from song start"
 * ARCHITECTURE.md — PlaybackStore drives EditorCanvas; tick updates via AudioEngine.onTick
 *
 *   happy: after transport stop, playbackTick source is null so the overlay hides the cursor
 *   happy: onTick subscription updates currentTick while playing (engine drives store)
 *   edges: rewind/seek leave a numeric tick (transport still "stopped" vs "paused" — seek is not "stopped")
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPlaybackEngineForTests } from '@/engine/audio';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { resetPlaybackStoreForTests, usePlaybackStore } from '@/store/playbackStore';

const { toneStart, transportTicks } = vi.hoisted(() => ({
  toneStart: vi.fn<[], Promise<void>>(),
  transportTicks: { value: 0 },
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
  getTransport: () => ({
    PPQ: 48,
    bpm: { value: 120 },
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
    get ticks() {
      return transportTicks.value;
    },
    set ticks(v: number) {
      transportTicks.value = v;
    },
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

describe('PlaybackStore — TASK-4.6 — playback tick + INTERFACES EditorCanvas.playbackTick', () => {
  beforeEach(() => {
    polyfillRaf();
    vi.clearAllMocks();
    transportTicks.value = 0;
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
    it('sets currentTick to null on stop so EditorCanvas playbackTick is null when stopped (INTERFACES)', async () => {
      await usePlaybackStore.getState().initializeAudio();
      usePlaybackStore.getState().play();
      expect(usePlaybackStore.getState().isPlaying).toBe(true);

      usePlaybackStore.getState().stop();

      expect(usePlaybackStore.getState().isPlaying).toBe(false);
      expect(usePlaybackStore.getState().currentTick).toBeNull();
    });

    it('updates currentTick from AudioEngine onTick while playing', async () => {
      await usePlaybackStore.getState().initializeAudio();
      usePlaybackStore.getState().play();

      transportTicks.value = 144;
      await new Promise<void>((r) => {
        requestAnimationFrame(() => r());
      });
      await new Promise<void>((r) => {
        requestAnimationFrame(() => r());
      });

      expect(usePlaybackStore.getState().currentTick).toBe(144);
    });
  });
});
