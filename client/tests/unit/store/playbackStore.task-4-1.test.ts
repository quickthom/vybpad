/*
 * QA COVERAGE PLAN — 4.1 (PlaybackStore + engine wiring)
 *
 * Criterion 1: Audio engine does not initialize before user gesture
 *   happy: play() before initializeAudioFromUserGesture does not start playback
 *   error: —
 *   edges: —
 *
 * Criterion 2: User gesture initializes audio exactly once and exposes ready state
 *   happy: initializeAudioFromUserGesture() then play() reaches isPlaying
 *   error: —
 *   edges: —
 *
 * Criterion 3: Repeated init attempts are idempotent
 *   happy: duplicate initializeAudioFromUserGesture + duplicate engine.initialize paths
 *   error: —
 *   edges: —
 *
 * Interface: INTERFACES.md — PlaybackStore; TASK-4.1 store extensions (audioReadyState, initializeAudioFromUserGesture)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPlaybackEngineForTests } from '@/engine/audio';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import {
  resetPlaybackStoreForTests,
  usePlaybackStore,
} from '@/store/playbackStore';

const { toneStart } = vi.hoisted(() => ({
  toneStart: vi.fn<[], Promise<void>>(),
}));

vi.mock('tone', () => ({
  __esModule: true,
  start: () => toneStart(),
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

describe('PlaybackStore — TASK 4.1 — INTERFACES PlaybackStore + gesture-gated audio', () => {
  beforeEach(() => {
    polyfillRaf();
    vi.clearAllMocks();
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
    it('exposes default PlaybackStore fields before any playback', () => {
      const s = usePlaybackStore.getState();
      expect(s.isPlaying).toBe(false);
      expect(s.currentTick).toBeNull();
      expect(s.audioReadyState).toBe('idle');
      expect(typeof s.play).toBe('function');
      expect(typeof s.pause).toBe('function');
      expect(typeof s.stop).toBe('function');
      expect(typeof s.rewind).toBe('function');
      expect(typeof s.seekTo).toBe('function');
      expect(typeof s.setLoop).toBe('function');
      expect(typeof s.initializeAudioFromUserGesture).toBe('function');
    });

    it('does not start playback before initializeAudioFromUserGesture completes', async () => {
      usePlaybackStore.getState().play();
      await Promise.resolve();
      await Promise.resolve();
      expect(usePlaybackStore.getState().audioReadyState).toBe('idle');
      expect(usePlaybackStore.getState().isPlaying).toBe(false);
    });

    it('reaches isPlaying after initializeAudioFromUserGesture and play()', async () => {
      await usePlaybackStore.getState().initializeAudioFromUserGesture();
      await usePlaybackStore.getState().initializeAudioFromUserGesture();

      usePlaybackStore.getState().play();

      expect(usePlaybackStore.getState().audioReadyState).toBe('ready');
      expect(usePlaybackStore.getState().isPlaying).toBe(true);
    });
  });

  describe('idempotent initialization', () => {
    it('keeps a single ready state when initializeAudioFromUserGesture is awaited twice', async () => {
      await usePlaybackStore.getState().initializeAudioFromUserGesture();
      await usePlaybackStore.getState().initializeAudioFromUserGesture();
      expect(usePlaybackStore.getState().audioReadyState).toBe('ready');
    });
  });

  describe('edge cases', () => {
    it('does not throw when play is invoked repeatedly while the engine is still cold', () => {
      expect(() => {
        usePlaybackStore.getState().play();
        usePlaybackStore.getState().play();
        usePlaybackStore.getState().play();
      }).not.toThrow();
    });

    it('does not throw when play is invoked repeatedly immediately after init', async () => {
      await usePlaybackStore.getState().initializeAudioFromUserGesture();

      expect(() => {
        usePlaybackStore.getState().play();
        usePlaybackStore.getState().play();
        usePlaybackStore.getState().play();
      }).not.toThrow();

      expect(usePlaybackStore.getState().isPlaying).toBe(true);
    });
  });
});
