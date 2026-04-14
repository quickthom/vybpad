/*
 * QA COVERAGE PLAN — TASK-4.6 (playback cursor render contract)
 *
 * ROADMAP 4.6: overlay / position callback → render; tick-aligned vertical line
 * INTERFACES: absolute tick from song start; UX_GUIDELINES / PAT-012 — cursor color #EF4444, 2px
 *
 * Pure renderer helper (no React): given tick + viewport + song, stroke a vertical line at
 * Math.round(absoluteTickToViewportX(tick)) + 0.5 from y=0 to canvas height (same as grid tick alignment).
 *
 * Implementation: `client/src/engine/renderer/drawPlaybackCursor.ts` (exported from renderer barrel).
 */

import type { Measure, SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  absoluteTickToViewportX,
  CHORD_AREA_HEIGHT,
  MEASURE_HEADER_HEIGHT,
  NOTE_HEIGHT,
  PLAYBACK_CURSOR_COLOR,
  PLAYBACK_CURSOR_WIDTH,
} from '../../../../src/engine/renderer/index';
import { drawPlaybackCursor } from '../../../../src/engine/renderer/drawPlaybackCursor';

/** Matches {@link EditorCanvas} staff height: 28 diatonic rows (PAT-012). */
const STAFF_DIATONIC_ROWS = 28;

function emptyMeasure(id: string): Measure {
  return { id, chords: [], notes: [[], [], [], []] };
}

function minimalSong44(measureCount: number): SongData {
  const measures: Measure[] = [];
  for (let i = 0; i < measureCount; i++) {
    measures.push(emptyMeasure(`00000000-0000-4000-8000-00000000000${i}`));
  }
  return {
    version: '1.0',
    metadata: {
      title: 't',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures,
    bandConfig: { tracks: [] },
  };
}

function vp(overrides: Partial<Viewport> = {}): Viewport {
  return {
    startMeasure: 0,
    measureCount: 8,
    scrollY: 0,
    zoom: 1,
    ...overrides,
  };
}

/** Minimal 2D context stub with writable strokeStyle / lineWidth (canvas mocks). */
function mockCtx(): CanvasRenderingContext2D {
  let strokeStyle = '';
  let lineWidth = 1;
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  };
  Object.defineProperty(ctx, 'strokeStyle', {
    get() {
      return strokeStyle;
    },
    set(v: string) {
      strokeStyle = v;
    },
    configurable: true,
  });
  Object.defineProperty(ctx, 'lineWidth', {
    get() {
      return lineWidth;
    },
    set(v: number) {
      lineWidth = v;
    },
    configurable: true,
  });
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('drawPlaybackCursor — TASK-4.6 — tick-aligned vertical line (renderer contract)', () => {
  it('strokes a full-height vertical line at Math.round(absoluteTickToViewportX)+0.5 with PAT-012 cursor color and width', () => {
    const song = minimalSong44(2);
    const viewport = vp({ measureCount: 2 });
    const tick = 96;
    const cssH = MEASURE_HEADER_HEIGHT + CHORD_AREA_HEIGHT + STAFF_DIATONIC_ROWS * NOTE_HEIGHT;
    const expectedX = Math.round(absoluteTickToViewportX(tick, viewport, song)) + 0.5;

    const ctx = mockCtx();
    drawPlaybackCursor(ctx, song, viewport, tick, cssH);

    expect(ctx.strokeStyle).toBe(PLAYBACK_CURSOR_COLOR);
    expect(ctx.lineWidth).toBe(PLAYBACK_CURSOR_WIDTH);
    expect(PLAYBACK_CURSOR_COLOR).toBe('#EF4444');
    expect(PLAYBACK_CURSOR_WIDTH).toBe(2);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(expectedX, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(expectedX, cssH);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('does not stroke when playbackTick is null (INTERFACES — no cursor when stopped)', () => {
    const song = minimalSong44(1);
    const viewport = vp();
    const ctx = mockCtx();
    drawPlaybackCursor(ctx, song, viewport, null, 100);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});
