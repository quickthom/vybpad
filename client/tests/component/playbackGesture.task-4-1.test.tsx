/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — 4.1 (RTL / gesture)
 *
 * Criterion 1–3: User-facing play control does not throw on repeated clicks before init
 *   happy: synthetic clicks invoke store play without unhandled errors
 *   error: —
 *   edges: rapid double-click
 *
 * Complements Playwright E2E; uses the same PlaybackStore public surface.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getPlaybackEngine, resetPlaybackEngineForTests } from '@/engine/audio';
import { usePlaybackStore } from '@/store/playbackStore';

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

function GesturePlayHarness() {
  const play = usePlaybackStore((s) => s.play);
  return (
    <button type="button" data-testid="gesture-play" onClick={() => play()}>
      Play
    </button>
  );
}

describe('Playback gesture — TASK 4.1 — RTL', () => {
  it('does not throw when the user double-clicks play before the audio engine is initialized', () => {
    vi.clearAllMocks();
    toneStart.mockResolvedValue(undefined);
    resetPlaybackEngineForTests();

    render(<GesturePlayHarness />);

    const btn = screen.getByTestId('gesture-play');
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(getPlaybackEngine().isReady()).toBe(false);
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });
});
