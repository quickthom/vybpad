/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — TASK-4.6
 *
 * INTERFACES — EditorCanvas.playbackTick + AudioEngine.onTick → render
 * ARCHITECTURE — single-canvas layered draw order; cursor drawn after grid/chords/notes/guides
 *
 *   happy: paint delegates to drawPlaybackCursor with playbackTick (number or null per INTERFACES)
 *   happy: non-null tick is passed through for tick-aligned vertical line
 */

import type { SongData, Viewport } from '@vybpad/shared';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { drawPlaybackCursor } from '@/engine/renderer/drawPlaybackCursor';

vi.mock('@/engine/renderer/drawPlaybackCursor', () => ({
  drawPlaybackCursor: vi.fn(),
}));

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

const DEFAULT_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};

const MINIMAL_SONG: SongData = {
  version: '1.0',
  metadata: {
    title: 'T',
    key: 'C',
    scale: 'major',
    tempo: 120,
    meter: { numerator: 4, denominator: 4 },
  },
  measures: [
    {
      id: '00000000-0000-4000-8000-000000000000',
      chords: [],
      notes: [[], [], [], []],
    },
  ],
  bandConfig: { tracks: [] },
};

describe('EditorCanvas — TASK-4.6 — playback cursor wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubCanvas2d();
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 800,
      height: 400,
      top: 0,
      left: 0,
      right: 800,
      bottom: 400,
      toJSON() {
        return {};
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('calls drawPlaybackCursor with playbackTick and layout height when tick is non-null', () => {
    const tick = 240;
    render(
      <EditorCanvas
        song={MINIMAL_SONG}
        viewport={DEFAULT_VIEWPORT}
        selection={null}
        playbackTick={tick}
        activeVoice={0}
        entryMode="table"
        showGuides={false}
        colorScheme="diatonic"
        onChordEdit={vi.fn()}
        onNoteEdit={vi.fn()}
        onSelectionChange={vi.fn()}
        onViewportChange={vi.fn()}
      />,
    );

    expect(drawPlaybackCursor).toHaveBeenCalled();
    const args = vi.mocked(drawPlaybackCursor).mock.calls[0];
    expect(args?.[2]).toBe(DEFAULT_VIEWPORT);
    expect(args?.[1]).toBe(MINIMAL_SONG);
    expect(args?.[3]).toBe(tick);
    expect(typeof args?.[4]).toBe('number');
    expect(args?.[4] as number).toBeGreaterThan(0);
  });

  it('passes null playbackTick into drawPlaybackCursor when stopped (renderer no-ops; INTERFACES null when stopped)', () => {
    render(
      <EditorCanvas
        song={MINIMAL_SONG}
        viewport={DEFAULT_VIEWPORT}
        selection={null}
        playbackTick={null}
        activeVoice={0}
        entryMode="table"
        showGuides={false}
        colorScheme="diatonic"
        onChordEdit={vi.fn()}
        onNoteEdit={vi.fn()}
        onSelectionChange={vi.fn()}
        onViewportChange={vi.fn()}
      />,
    );

    expect(drawPlaybackCursor).toHaveBeenCalledWith(
      expect.anything(),
      MINIMAL_SONG,
      DEFAULT_VIEWPORT,
      null,
      expect.any(Number),
    );
  });
});
