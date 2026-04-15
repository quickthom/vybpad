/*
 * F-07 — UX §6 playback highlight (amber stroke on sounding notes/chords).
 */

import type { ChordEvent, Measure, SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  PLAYBACK_HIGHLIGHT_COLOR,
  PLAYBACK_HIGHLIGHT_LINE_WIDTH,
} from '../../../../src/engine/renderer/constants';
import { drawPlaybackHighlight } from '../../../../src/engine/renderer/drawPlaybackHighlight';

function chord(id: string, beat: number, duration: number): ChordEvent {
  return {
    id,
    scaleDegree: 1,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat,
    duration,
  };
}

function emptyMeasure(id: string): Measure {
  return { id, chords: [], notes: [[], [], [], []] };
}

function minimalSongWithChord(): SongData {
  return {
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
        id: '00000000-0000-4000-8000-000000000001',
        chords: [chord('c1', 0, 192)],
        notes: [[], [], [], []],
      },
      emptyMeasure('00000000-0000-4000-8000-000000000002'),
    ],
    bandConfig: { tracks: [] },
  };
}

function vp(): Viewport {
  return { startMeasure: 0, measureCount: 8, scrollY: 0, zoom: 1 };
}

function mockCtx(): CanvasRenderingContext2D {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    stroke: vi.fn(),
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('drawPlaybackHighlight — F-07 — §6 amber stroke when tick inside event', () => {
  it('strokes when playbackTick is inside a chord [start, end)', () => {
    const song = minimalSongWithChord();
    const viewport = vp();
    const ctx = mockCtx();

    drawPlaybackHighlight(ctx, song, viewport, 96);

    expect(ctx.strokeStyle).toBe(PLAYBACK_HIGHLIGHT_COLOR);
    expect(ctx.lineWidth).toBe(PLAYBACK_HIGHLIGHT_LINE_WIDTH);
    expect(PLAYBACK_HIGHLIGHT_COLOR).toBe('#F59E0B');
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.roundRect).toHaveBeenCalled();
  });

  it('does not stroke when playbackTick is at or past chord end (half-open interval)', () => {
    const song = minimalSongWithChord();
    const viewport = vp();
    const ctx = mockCtx();

    drawPlaybackHighlight(ctx, song, viewport, 192);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('no-op when playbackTick is null', () => {
    const song = minimalSongWithChord();
    const ctx = mockCtx();
    drawPlaybackHighlight(ctx, song, vp(), null);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});
