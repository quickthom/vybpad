/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-7.5
 *
 * Criterion: Editor shell registers INTERFACES `ShortcutCommandId`s for zoom / scroll / selection / playback
 *   and dispatches to `UIStore` + `PlaybackStore` public surfaces (no duplicate legacy handling).
 *   happy: Ctrl+=/- zoom; Ctrl+0 reset; ArrowUp/Down scroll; ArrowLeft/Right selection; Space; Period stop; Comma rewind
 *   error: modal open suppresses shortcuts (PAT-027) — Key/scale dialog + Space
 *   edges: zoom clamp [0.25, 4]; scrollY >= 0
 *
 * ASSUMPTIONS:
 * - Chord strings below are the TASK-7.5 registration targets; Builder must match (or update this suite).
 * - Horizontal zoom is clamped to [0.25, 4] (Hookpad-style band); Builder adjusts constants if product differs.
 * - `scrollUp` decreases `scrollY` and `scrollDown` increases it (canvas pitch scroll convention).
 */

import type { ProjectResponse, SongData } from '@vybpad/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

/** TASK-7.5 default chords (INTERFACES `ShortcutCommandId` + PAT-027 normalized form). */
const TASK75_CHORDS = {
  zoomIn: { key: '=', code: 'Equal', ctrlKey: true },
  zoomOut: { key: '-', code: 'Minus', ctrlKey: true },
  resetZoom: { key: '0', code: 'Digit0', ctrlKey: true },
  scrollUp: { key: 'ArrowUp', code: 'ArrowUp' },
  scrollDown: { key: 'ArrowDown', code: 'ArrowDown' },
  playPause: { key: ' ', code: 'Space' },
  stopPlayback: { key: '.', code: 'Period' },
  rewindPlayback: { key: ',', code: 'Comma' },
  undo: { key: 'z', code: 'KeyZ', ctrlKey: true },
  redo: { key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true },
  undoMac: { key: 'z', code: 'KeyZ', metaKey: true },
  redoMac: { key: 'z', code: 'KeyZ', metaKey: true, shiftKey: true },
} as const;

const EXPECT_ZOOM_MIN = 0.25;
const EXPECT_ZOOM_MAX = 4;

const BOOTSTRAP_PROJECT_ID = '00000000-0000-4000-8000-000000000001';

function projectPayloadForSong(song: SongData): ProjectResponse {
  const now = new Date().toISOString();
  return {
    id: BOOTSTRAP_PROJECT_ID,
    name: 'TASK-7.5',
    songData: song,
    createdAt: now,
    updatedAt: now,
  };
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
  });

  afterEach(() => {
    resetPlaybackStoreForTests();
    resetPlaybackEngineForTests();
  });

  /**
   * Mount `/editor/:projectId` with POST-bootstrap `location.state` so `EditorLayout` hydrates `songData`
   * once and does not replace it with `buildDefaultSong()` from the no-project branch (TASK-3.2 / TASK-7.5).
   */
  async function focusSongCanvas(song: SongData = buildDefaultSong()): Promise<HTMLElement> {
    const project = projectPayloadForSong(song);
    render(
      <MemoryRouter
        initialEntries={[{ pathname: `/editor/${BOOTSTRAP_PROJECT_ID}`, state: { project } }]}
      >
        <Routes>
          <Route path="/editor/:projectId" element={<EditorLayout />} />
        </Routes>
      </MemoryRouter>,
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

  it('does not increase zoom beyond EXPECT_ZOOM_MAX when zoom-in is pressed at the maximum zoom level', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    useUIStore.getState().setViewport({
      ...useUIStore.getState().viewport,
      zoom: EXPECT_ZOOM_MAX,
    });

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.zoomIn,
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(useUIStore.getState().viewport.zoom).toBe(EXPECT_ZOOM_MAX);
    });
  });

  it('does not decrease zoom below EXPECT_ZOOM_MIN when zoom-out is pressed at the minimum zoom level', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    useUIStore.getState().setViewport({
      ...useUIStore.getState().viewport,
      zoom: EXPECT_ZOOM_MIN,
    });

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.zoomOut,
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(useUIStore.getState().viewport.zoom).toBe(EXPECT_ZOOM_MIN);
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

  it('changes scrollY when ArrowDown is pressed (scroll down increases scrollY)', async () => {
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

  it('calls PlaybackStore stop when Period is pressed while playing (stopPlayback)', async () => {
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

  it('invokes PlaybackStore rewind when Comma is pressed (rewindPlayback)', async () => {
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

  it('undoes the last song mutation when Ctrl+Z is pressed', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    const initialCount = useSongStore.getState().song.measures[0]!.chords.length;
    useSongStore.getState().editChord(0, {
      type: 'add',
      chord: {
        scaleDegree: 3,
        quality: 'minor',
        seventh: 'none',
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: null,
        beat: 96,
        duration: 48,
      },
    });
    expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount + 1);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.undo,
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount);
    });
  });

  it('undoes the last song mutation when Meta+Z is pressed', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    const initialCount = useSongStore.getState().song.measures[0]!.chords.length;
    useSongStore.getState().editChord(0, {
      type: 'add',
      chord: {
        scaleDegree: 3,
        quality: 'minor',
        seventh: 'none',
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: null,
        beat: 96,
        duration: 48,
      },
    });
    expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount + 1);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.undoMac,
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount);
    });
  });

  it('redoes the last undone song mutation when Ctrl+Shift+Z is pressed', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    const initialCount = useSongStore.getState().song.measures[0]!.chords.length;
    useSongStore.getState().editChord(0, {
      type: 'add',
      chord: {
        scaleDegree: 3,
        quality: 'minor',
        seventh: 'none',
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: null,
        beat: 96,
        duration: 48,
      },
    });
    expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount + 1);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.undo,
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount);
    });

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.redo,
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount + 1);
    });
  });

  it('redoes the last undone song mutation when Meta+Shift+Z is pressed', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    const initialCount = useSongStore.getState().song.measures[0]!.chords.length;
    useSongStore.getState().editChord(0, {
      type: 'add',
      chord: {
        scaleDegree: 3,
        quality: 'minor',
        seventh: 'none',
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: null,
        beat: 96,
        duration: 48,
      },
    });
    expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount + 1);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.undo,
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount);
    });

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.redoMac,
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount + 1);
    });
  });

  it('does not redo the last undone song mutation when Meta+Shift+Z is pressed while key/scale modal is open', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    const initialCount = useSongStore.getState().song.measures[0]!.chords.length;
    useSongStore.getState().editChord(0, {
      type: 'add',
      chord: {
        scaleDegree: 3,
        quality: 'minor',
        seventh: 'none',
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: null,
        beat: 96,
        duration: 48,
      },
    });
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.undo,
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount);
    });

    fireEvent.click(screen.getByRole('button', { name: /key \/ scale/i }));
    expect(await screen.findByRole('dialog', { name: /key and scale/i })).toBeTruthy();

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.redoMac,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount);
  });

  it('does not undo when text input is focused (PAT-027 global gating)', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    const initialCount = useSongStore.getState().song.measures[0]!.chords.length;
    useSongStore.getState().editChord(0, {
      type: 'add',
      chord: {
        scaleDegree: 3,
        quality: 'minor',
        seventh: 'none',
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: null,
        beat: 96,
        duration: 48,
      },
    });
    expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount + 1);

    const tempo = screen.getByRole('spinbutton', { name: /tempo/i });
    tempo.focus();
    expect(document.activeElement).toBe(tempo);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.undoMac,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(useSongStore.getState().song.measures[0]!.chords).toHaveLength(initialCount + 1);
  });

  it('does not drive scrollY negative when ArrowUp is pressed at scrollY 0', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    useUIStore.getState().setViewport({
      ...useUIStore.getState().viewport,
      scrollY: 0,
    });

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.scrollUp,
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(useUIStore.getState().viewport.scrollY).toBe(0);
    });
  });

  it('does not start playback when Key/scale modal is open and Space is pressed (PAT-027 gating)', async () => {
    stubCanvas2d();
    await focusSongCanvas();

    await usePlaybackStore.getState().initializeAudio();
    expect(usePlaybackStore.getState().initStatus).toBe('ready');

    fireEvent.click(screen.getByRole('button', { name: /key \/ scale/i }));
    expect(await screen.findByRole('dialog', { name: /key and scale/i })).toBeTruthy();

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...TASK75_CHORDS.playPause,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });

});
