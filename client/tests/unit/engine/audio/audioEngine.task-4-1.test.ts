/*
 * QA COVERAGE PLAN — 4.1
 *
 * Criterion 1: Audio engine does not initialize before user gesture
 *   happy: isReady() is false until initialize() runs
 *   error: —
 *   edges: —
 *
 * Criterion 2: User gesture initializes audio exactly once and exposes ready state
 *   happy: initialize() resolves; isReady() becomes true; loadSong + play callable
 *   error: —
 *   edges: —
 *
 * Criterion 3: Repeated init attempts are idempotent
 *   happy: second initialize() does not throw; isReady() stays true
 *   error: —
 *   edges: —
 *
 * Criterion 4: Failure path surfaces PAT-001-compliant user-safe behavior
 *   happy: typed playback error + getPlaybackErrorMessage has no raw stack/engine strings
 *   error: Tone.start fails
 *   edges: —
 *
 * Public surface: `getPlaybackEngine`, `resetPlaybackEngineForTests` (engine/audio),
 * `getPlaybackErrorMessage` (playbackErrors / PAT-001).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPlaybackEngine,
  getPlaybackErrorMessage,
  resetPlaybackEngineForTests,
} from '@/engine/audio';

const { toneStart } = vi.hoisted(() => ({
  toneStart: vi.fn<[], Promise<void>>(),
}));

vi.mock('@/engine/audio/pianoSampleLoader', () => ({
  ensurePianoSamplesLoaded: vi.fn(() => Promise.resolve()),
  disposePianoSamples: vi.fn(),
  resetPianoSampleCacheForTests: vi.fn(),
  getPianoInstrument: vi.fn(() => null),
}));

/** Tone is imported as `await import('tone')` — `start` / `getTransport` live on the namespace, not `default`. */
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
    ticks: 0,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
  }),
}));

function disposeEngine(): void {
  resetPlaybackEngineForTests();
}

function polyfillRaf(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number;
  }
  if (typeof globalThis.cancelAnimationFrame !== 'function') {
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }
}

describe('Playback engine — TASK 4.1 — INTERFACES AudioEngine (via getPlaybackEngine)', () => {
  beforeEach(() => {
    polyfillRaf();
    vi.clearAllMocks();
    toneStart.mockResolvedValue(undefined);
  });

  afterEach(() => {
    disposeEngine();
  });

  describe('happy path', () => {
    it('reports isReady() false before initialize() and true after initialize() resolves', async () => {
      const engine = getPlaybackEngine();
      expect(engine.isReady()).toBe(false);

      await engine.initialize();

      expect(engine.isReady()).toBe(true);
    });

    it('allows loadSong then play after initialize() without throwing', async () => {
      const engine = getPlaybackEngine();
      await engine.initialize();

      expect(() =>
        engine.loadSong({
          version: '1.0',
          metadata: {
            title: 't',
            key: 'C',
            scale: 'major',
            tempo: 120,
            meter: { numerator: 4, denominator: 4 },
          },
          measures: [
            {
              id: 'm1',
              chords: [],
              notes: [[], [], [], []],
            },
          ],
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
        }),
      ).not.toThrow();

      expect(() => engine.play()).not.toThrow();
    });
  });

  describe('idempotent initialization', () => {
    it('does not throw when initialize() is awaited twice and isReady() remains true', async () => {
      const engine = getPlaybackEngine();
      await engine.initialize();
      await expect(engine.initialize()).resolves.toBeUndefined();
      expect(engine.isReady()).toBe(true);
    });
  });

  describe('error handling (PAT-001 user-safe)', () => {
    it('exposes a user-safe message via getPlaybackErrorMessage when Tone.start fails', async () => {
      toneStart.mockRejectedValueOnce(new Error('AudioContext blocked'));

      const engine = getPlaybackEngine();

      let caught: unknown;
      try {
        await engine.initialize();
      } catch (e) {
        caught = e;
      }

      expect(caught).toMatchObject({ code: 'AUDIO_INIT_FAILED' });
      const msg = getPlaybackErrorMessage(caught);
      expect(msg).not.toMatch(/AudioContext blocked|at\s+.*\(|undefined/);
      expect(msg.length).toBeGreaterThan(8);
    });
  });
});
