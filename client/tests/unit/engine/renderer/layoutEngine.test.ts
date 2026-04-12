/*
 * QA COVERAGE PLAN — TASK-2.2
 *
 * Criterion 1 — tick↔pixel (horizontal, pure functions)
 *   happy: ticks→px and px→ticks agree at zoom 1.0 and 2.0 for representative values
 *   error/edges: round-trip stability; fractional pixels round to nearest tick
 *
 * Criterion 2 — viewport zoom
 *   happy: same tick delta scales linearly with viewport.zoom in viewport-relative X
 *   edges: fractional zoom; zoom 1.0 baseline
 *
 * Criterion 3 — measure boundaries (absolute tick alignment)
 *   happy: cumulative measure start ticks from per-measure lengths; 4/4 and mixed meters
 *   edges: measure index 0; multi-measure song slice
 *
 * Criterion 4 — 48 TPQN
 *   happy: exported TPQN is 48 and matches shared TICKS_PER_QUARTER; quarter/eighth tick sizes
 *   edges: measure length uses TPQN in formula consistent with ARCHITECTURE.md
 *
 * Criterion 5 — PAT-012 dimensions & colors
 *   happy: numeric constants and color strings match PATTERNS.md PAT-012 table
 *
 * Imports are limited to the public barrel `client/src/engine/renderer/index.ts` and
 * `@vybpad/shared` types/constants (INTERFACES / shared types).
 */

import type { TimeSignature, Viewport } from '@vybpad/shared';
import { TICKS_PER_QUARTER } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  absoluteTickToViewportX,
  BAR_LINE_COLOR,
  BEAT_WIDTH,
  CHORD_AREA_HEIGHT,
  GRID_LINE_COLOR,
  horizontalPxToTicks,
  horizontalTicksToPx,
  measureLengthInTicks,
  measureStartAbsoluteTick,
  MEASURE_HEADER_HEIGHT,
  NOTE_HEIGHT,
  PLAYBACK_CURSOR_COLOR,
  PLAYBACK_CURSOR_WIDTH,
  SELECTION_COLOR,
  TPQN,
  viewportXToAbsoluteTick,
} from '../../../../src/engine/renderer/index';

function meter(numerator: number, denominator: number): TimeSignature {
  return { numerator, denominator };
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

describe('Layout engine — tick↔pixel (horizontal)', () => {
  describe('happy path', () => {
    it('maps one quarter note (TPQN ticks) to BEAT_WIDTH pixels at zoom 1.0', () => {
      expect(horizontalTicksToPx(TPQN, 1)).toBe(BEAT_WIDTH);
    });

    it('maps horizontal pixels back to the same tick count at zoom 1.0 for a quarter note span', () => {
      expect(horizontalPxToTicks(BEAT_WIDTH, 1)).toBe(TPQN);
    });

    it('scales tick distance linearly with zoom (double zoom doubles pixels for the same ticks)', () => {
      const ticks = 48;
      expect(horizontalTicksToPx(ticks, 2)).toBe(horizontalTicksToPx(ticks, 1) * 2);
    });
  });

  describe('error handling', () => {
    it('does not throw for zero tick offset', () => {
      expect(() => horizontalTicksToPx(0, 1)).not.toThrow();
      expect(horizontalTicksToPx(0, 1)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('round-trips a non-quarter tick offset at zoom 1.0 (sixteenth note)', () => {
      const ticks = TPQN / 4;
      const px = horizontalTicksToPx(ticks, 1);
      expect(horizontalPxToTicks(px, 1)).toBe(ticks);
    });

    it('round-trips an odd tick count at zoom 1.25', () => {
      const ticks = 37;
      const px = horizontalTicksToPx(ticks, 1.25);
      expect(horizontalPxToTicks(px, 1.25)).toBe(ticks);
    });
  });
});

describe('Layout engine — viewport zoom (horizontal placement)', () => {
  describe('happy path', () => {
    it('places absoluteTick at the origin when it equals the start of viewport.startMeasure', () => {
      const measureLengths = [192, 192, 192];
      const viewport = vp({ startMeasure: 1, zoom: 1 });
      const absoluteTick = measureStartAbsoluteTick(measureLengths, 1);
      expect(absoluteTickToViewportX(absoluteTick, viewport, measureLengths)).toBe(0);
    });

    it('doubles the viewport-relative X when zoom doubles for the same absolute tick delta from the viewport origin', () => {
      const measureLengths = [192, 192];
      const absoluteTick = 96;
      const x1 = absoluteTickToViewportX(absoluteTick, vp({ startMeasure: 0, zoom: 1 }), measureLengths);
      const x2 = absoluteTickToViewportX(absoluteTick, vp({ startMeasure: 0, zoom: 2 }), measureLengths);
      expect(x2).toBeCloseTo(x1 * 2, 10);
    });
  });

  describe('edge cases', () => {
    it('uses startMeasure to subtract the correct number of leading ticks before converting to pixels', () => {
      const measureLengths = [192, 144];
      const viewport = vp({ startMeasure: 1, zoom: 1 });
      const startTick = measureStartAbsoluteTick(measureLengths, 1);
      const x = absoluteTickToViewportX(startTick + 48, viewport, measureLengths);
      expect(x).toBe(horizontalTicksToPx(48, 1));
    });
  });
});

describe('Layout engine — measure boundaries (absolute tick)', () => {
  describe('happy path', () => {
    it('returns 0 tick offset for the first measure', () => {
      const lengths = [192, 192, 192];
      expect(measureStartAbsoluteTick(lengths, 0)).toBe(0);
    });

    it('sums prior measure lengths for measureIndex > 0', () => {
      const lengths = [192, 192, 192];
      expect(measureStartAbsoluteTick(lengths, 2)).toBe(384);
    });

    it('computes 4/4 measure length as 192 ticks (48 TPQN)', () => {
      expect(measureLengthInTicks(meter(4, 4))).toBe(4 * TICKS_PER_QUARTER);
    });

    it('computes 6/8 measure length as 144 ticks per ARCHITECTURE timing model', () => {
      expect(measureLengthInTicks(meter(6, 8))).toBe(144);
    });
  });

  describe('edge cases', () => {
    it('supports varying meters across measures via explicit length array', () => {
      const lengths = [measureLengthInTicks(meter(4, 4)), measureLengthInTicks(meter(6, 8))];
      expect(measureStartAbsoluteTick(lengths, 1)).toBe(192);
    });
  });
});

describe('Layout engine — 48 TPQN', () => {
  describe('happy path', () => {
    it('exports TPQN as 48', () => {
      expect(TPQN).toBe(48);
    });

    it('keeps TPQN aligned with shared TICKS_PER_QUARTER', () => {
      expect(TPQN).toBe(TICKS_PER_QUARTER);
    });

    it('derives measure length from meter using TPQN (2/4 → 96 ticks)', () => {
      expect(measureLengthInTicks(meter(2, 4))).toBe((2 / 4) * 4 * TPQN);
    });
  });
});

describe('Layout engine — PAT-012 canvas constants', () => {
  describe('happy path', () => {
    it('exports PAT-012 pixel dimensions', () => {
      expect(BEAT_WIDTH).toBe(40);
      expect(NOTE_HEIGHT).toBe(20);
      expect(CHORD_AREA_HEIGHT).toBe(40);
      expect(MEASURE_HEADER_HEIGHT).toBe(24);
      expect(PLAYBACK_CURSOR_WIDTH).toBe(2);
    });

    it('exports PAT-012 color tokens as exact literals', () => {
      expect(GRID_LINE_COLOR).toBe('#E5E7EB');
      expect(BAR_LINE_COLOR).toBe('#6B7280');
      expect(PLAYBACK_CURSOR_COLOR).toBe('#EF4444');
      expect(SELECTION_COLOR).toBe('rgba(59, 130, 246, 0.2)');
    });
  });
});

describe('Layout engine — viewport X ↔ absolute tick inverse', () => {
  describe('happy path', () => {
    it('round-trips viewport-relative placement at zoom 1.0 inside the first measure', () => {
      const measureLengths = [192, 192];
      const viewport = vp({ startMeasure: 0, zoom: 1 });
      const absoluteTick = 80;
      const x = absoluteTickToViewportX(absoluteTick, viewport, measureLengths);
      expect(viewportXToAbsoluteTick(x, viewport, measureLengths)).toBe(absoluteTick);
    });

    it('round-trips at non-1.0 zoom', () => {
      const measureLengths = [192];
      const viewport = vp({ startMeasure: 0, zoom: 1.5 });
      const absoluteTick = 111;
      const x = absoluteTickToViewportX(absoluteTick, viewport, measureLengths);
      expect(viewportXToAbsoluteTick(x, viewport, measureLengths)).toBe(absoluteTick);
    });
  });
});
