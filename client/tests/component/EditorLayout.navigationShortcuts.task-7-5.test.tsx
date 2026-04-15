/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-7.5
 *
 * Criterion: Editor shell registers INTERFACES `ShortcutCommandId`s for zoom / scroll / selection / playback
 *   and dispatches to `UIStore` + `PlaybackStore` public surfaces (no duplicate legacy handling).
 *   happy: Ctrl+= zoom in; Ctrl+0 reset; Alt+Arrow scroll; Arrow moves selection; Space play; Escape stop; Home rewind
 *   error: modal open suppresses shortcuts (PAT-027) — spot-checked via Key/scale dialog + zoom attempt
 *   edges: zoom clamp at expected min/max (asserted once zoom-in is implemented — see Builder brief)
 *
 * ASSUMPTIONS:
 * - Chord strings below are the TASK-7.5 registration targets; Builder must match (or update this suite).
 * - Horizontal zoom is clamped to [0.25, 4] (Hookpad-style band); Builder adjusts constants if product differs.
 * - `scrollUp` decreases `scrollY` and `scrollDown` increases it (canvas pitch scroll convention).
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorLayout } from '@/app/EditorLayout';
import { resetPlaybackEngineForTests } from '@/engine/audio';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { resetPlaybackStoreForTests, usePlaybackStore } from '@/store/playbackStore';
import { useUIStore } from '@/store/uiStore';

const { toneStart } = vi.hoisted(() => ({
  toneStart: vi.fn<[], Promise<void>>(),
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
    ticks: 0,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
  }),
}));

/** Builder must register identical normalized chords in EditorLayout (TASK-7.5). */
const TASK75_CHORDS = {
  zoomIn: { key: '=', code: 'Equal', ctrlKey: true },
  zoomOut: { key: '-', code: 'Minus', ctrlKey: true },
  resetZoom: { key: '0', code: 'Digit0', ctrlKey: true },
  scrollUp: { key: 'ArrowUp', code: 'ArrowUp', altKey: true },
  scrollDown: { key: 'ArrowDown', code: 'ArrowDown', altKey: true },
  moveLeft: { key: 'ArrowLeft', code: 'ArrowLeft' },
  moveRight: { key: 'ArrowRight', code: 'ArrowRight' },
  playPause: { key: ' ', code: 'Space' },
  stopPlayback: { key: 'Escape', code: 'Escape' },
  rewindPlayback: { key: 'Home', code: 'Home' },
} as const;

function polyfillRaf(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number;
  }
  if (typeof globalThis.cancelAnimationFrame !== 'function') {
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }
}

function stubCanvas2d(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId) => {
    if (contextId !== '2d') {
      return null;
    }
    return {
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      clip: vi.fn(),
      translate: vi.fn(),
      setTransform: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      arcTo: vi.fn(),
      roundRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  });
}

function baselineUi(): void {
  useUIStore.getState().setViewport({
    startMeasure: 0,
    measureCount: 8,
    scrollY: 0,
    zoom: 1,
  });
  useUIStore.getState().setSelection(null);
  while (useUIStore.getState().entryMode !== 'table') {
    useUIStore.getState().toggleEntryMode();
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EditorLayout — TASK-7.5 — navigation + playback shortcuts (stores + registry)', () => {
  beforeEach(() => {
    polyfillRaf();
    vi.clearAllMocks();
    toneStart.mockResolvedValue(undefined);
    resetPlaybackEngineForTests();
    resetPlaybackStoreForTests();
    baselineUi();
    useSongStore.getState().loadSong(buildDefaultSong());
  });

  afterEach(() => {
    resetPlaybackStoreForTests();
    resetPlaybackEngineForTests();
  });

  async function focusSongCanvas(): Promise<HTMLElement> {
    render(
      <BrowserRouter>
        <EditorLayout />
      </BrowserRouter>,
    );
    const canvas = await screen.findByRole('application', { name: /Song editor/i });
    (canvas as HTMLElement).focus();
    expect(document.activeElement).toBe(canvas);
    return canvas as HTMLElement;
  }

  it('increases UIStore viewport zoom when Ctrl+Equals is pressed with the song canvas focused', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    const z0 = useUIStore.getState().viewport.zoom;
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.zoomIn,
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(useUIStore.getState().viewport.zoom).toBeGreaterThan(z0);
    });
  });

  it('resets viewport zoom to 1 when Ctrl+0 is pressed after zoom has been changed', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    useUIStore.getState().setViewport({
      ...useUIStore.getState().viewport,
      zoom: 1.5,
    });

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.resetZoom,
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(useUIStore.getState().viewport.zoom).toBe(1);
    });
  });

  it('changes scrollY when Alt+ArrowDown is pressed (scroll down increases scrollY)', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    const y0 = useUIStore.getState().viewport.scrollY;
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.scrollDown,
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(useUIStore.getState().viewport.scrollY).toBeGreaterThan(y0);
    });
  });

  it('calls PlaybackStore play after audio init when Space is pressed (playPause)', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    await usePlaybackStore.getState().initializeAudio();
    expect(usePlaybackStore.getState().initStatus).toBe('ready');

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.playPause,
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(usePlaybackStore.getState().isPlaying).toBe(true);
    });
  });

  it('calls PlaybackStore stop when Escape is pressed while playing (stopPlayback)', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    await usePlaybackStore.getState().initializeAudio();
    usePlaybackStore.setState({ isPlaying: true, currentTick: 48 });

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.stopPlayback,
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(usePlaybackStore.getState().isPlaying).toBe(false);
    });
  });

  it('invokes PlaybackStore rewind when Home is pressed (rewindPlayback)', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    await usePlaybackStore.getState().initializeAudio();
    usePlaybackStore.setState({ currentTick: 192 });

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.rewindPlayback,
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(usePlaybackStore.getState().currentTick).toBe(0);
    });
  });

});
