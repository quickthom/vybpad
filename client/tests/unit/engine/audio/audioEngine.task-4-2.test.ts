/*
 * TASK-4.2 — AudioEngine.initialize wires lazy sample load; failures stay typed (PAT-001).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPlaybackEngine,
  PLAYBACK_ERROR_CODES,
  PlaybackError,
  resetPlaybackEngineForTests,
} from '@/engine/audio';

const { toneStart, mockEnsurePiano } = vi.hoisted(() => ({
  toneStart: vi.fn<[], Promise<void>>(),
  mockEnsurePiano: vi.fn<[], Promise<void>>(),
}));

vi.mock('@/store/toastStore', () => ({
  useToastStore: {
    getState: () => ({ showError: vi.fn() }),
  },
}));

vi.mock('@/engine/audio/pianoSampleLoader', () => ({
  ensurePianoSamplesLoaded: () => mockEnsurePiano(),
  disposePianoSamples: vi.fn(),
  resetPianoSampleCacheForTests: vi.fn(),
  getPianoInstrument: vi.fn(() => null),
}));

vi.mock('tone', () => ({
  __esModule: true,
  start: () => toneStart(),
  getContext: () => ({
    rawContext: { destination: {} },
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

describe('Playback engine — TASK-4.2 — sample load wiring', () => {
  beforeEach(() => {
    polyfillRaf();
    vi.clearAllMocks();
    toneStart.mockResolvedValue(undefined);
    mockEnsurePiano.mockResolvedValue(undefined);
    resetPlaybackEngineForTests();
  });

  afterEach(() => {
    resetPlaybackEngineForTests();
  });

  it('calls ensurePianoSamplesLoaded once across duplicate initialize() success paths', async () => {
    const engine = getPlaybackEngine();
    await engine.initialize();
    await engine.initialize();
    expect(mockEnsurePiano).toHaveBeenCalledTimes(1);
    expect(engine.isReady()).toBe(true);
  });

  it('surfaces SAMPLE_LOAD_FAILED without wrapping in a generic init error', async () => {
    mockEnsurePiano.mockRejectedValueOnce(
      new PlaybackError(PLAYBACK_ERROR_CODES.SAMPLE_LOAD_FAILED),
    );

    const engine = getPlaybackEngine();
    let caught: unknown;
    try {
      await engine.initialize();
    } catch (e) {
      caught = e;
    }

    expect(caught).toMatchObject({ code: PLAYBACK_ERROR_CODES.SAMPLE_LOAD_FAILED });
    expect(engine.isReady()).toBe(false);
  });
});
