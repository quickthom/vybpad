/*
 * QA COVERAGE PLAN — 4.3 (playback regression gate)
 *
 * Criterion: loadSong + play + stop tolerate voicing-heavy SongData without throwing.
 * Uses mocked Tone.js (same pattern as TASK-4.1 audio tests).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPlaybackEngine,
  resetPlaybackEngineForTests,
} from '@/engine/audio';

import { buildVoicingHeavySong } from '../../../fixtures/voicingHeavySong';

const { toneStart } = vi.hoisted(() => ({
  toneStart: vi.fn<[], Promise<void>>(),
}));

vi.mock('smplr', () => ({
  __esModule: true,
  CacheStorage: class {
    constructor(_bucket: string) {
      void _bucket;
    }
  },
  SplendidGrandPiano: class {
    load = Promise.resolve();
    disconnect(): void {}
  },
}));

vi.mock('tone', () => ({
  __esModule: true,
  start: () => toneStart(),
  getContext: () => ({
    rawContext: {} as AudioContext,
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

describe('Playback engine — TASK-4.3 — voicing-heavy song regression', () => {
  beforeEach(() => {
    polyfillRaf();
    vi.clearAllMocks();
    toneStart.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetPlaybackEngineForTests();
  });

  describe('happy path', () => {
    it('initializes, loadSong with dense chord progression, play, and stop without throwing', async () => {
      const engine = getPlaybackEngine();
      await engine.initialize();

      const song = buildVoicingHeavySong();

      expect(() => engine.loadSong(song)).not.toThrow();
      expect(() => {
        engine.play();
        engine.stop();
      }).not.toThrow();
    });

    it('allows loadSong twice (re-schedule) on the same engine without throwing', async () => {
      const engine = getPlaybackEngine();
      await engine.initialize();
      const song = buildVoicingHeavySong();
      engine.loadSong(song);
      expect(() => engine.loadSong(song)).not.toThrow();
      expect(() => engine.play()).not.toThrow();
      engine.stop();
    });
  });
});
