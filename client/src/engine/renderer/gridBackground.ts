import type { SongData, Viewport } from '@vybpad/shared';

import { MELODY_DIATONIC_ROW_COUNT } from './constants';
import {
  absoluteTickToViewportX,
  BAR_LINE_COLOR,
  GRID_LINE_COLOR,
  MEASURE_HEADER_HEIGHT,
  getMeasureStartTicks,
  getMeterAtMeasure,
  measureLengthInTicks,
  noteStaffTopY,
  TPQN,
} from './layout';

/** UX_GUIDELINES.md §2 — Measure numbers on canvas */
export const MEASURE_NUMBER_COLOR = '#374151';

/** UI sans stack + 11px / 600 per UX §2 canvas label table */
export const MEASURE_NUMBER_FONT =
  '600 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';

export interface GridBackgroundLayout {
  /** Viewport-relative X for each measure boundary bar (left edge through closing edge). */
  readonly barLines: readonly number[];
  /** Viewport-relative X for internal quarter-note grid lines (48-tick steps, PAT-004). */
  readonly gridLines: readonly number[];
  /** Labels drawn in the measure header band; `x` is already offset for left padding. */
  readonly measureNumbers: readonly { readonly x: number; readonly label: string; readonly measureIndex: number }[];
}

/**
 * Computes viewport-space geometry for the non-interactive grid layer: quarter-note subdivisions,
 * measure bar lines, and measure number positions. Uses {@link absoluteTickToViewportX} and
 * {@link measureLengthInTicks} — no duplicate tick↔pixel math.
 */
export function computeGridBackgroundLayout(song: SongData, viewport: Viewport): GridBackgroundLayout {
  const n = song.measures.length;
  const first = viewport.startMeasure;
  const count = viewport.measureCount;
  if (n === 0 || count <= 0 || first < 0 || first >= n) {
    return { barLines: [], gridLines: [], measureNumbers: [] };
  }

  const lastExclusive = Math.min(first + count, n);
  if (first >= lastExclusive) {
    return { barLines: [], gridLines: [], measureNumbers: [] };
  }

  const starts = getMeasureStartTicks(song);

  const barLines: number[] = [];
  for (let b = first; b <= lastExclusive; b++) {
    barLines.push(absoluteTickToViewportX(starts[b], viewport, song));
  }

  const gridLines: number[] = [];
  for (let m = first; m < lastExclusive; m++) {
    const len = measureLengthInTicks(getMeterAtMeasure(song, m));
    const startAbs = starts[m];
    for (let t = TPQN; t < len; t += TPQN) {
      gridLines.push(absoluteTickToViewportX(startAbs + t, viewport, song));
    }
  }

  const measureNumbers: { x: number; label: string; measureIndex: number }[] = [];
  const labelPadX = 4;
  for (let m = first; m < lastExclusive; m++) {
    const xBar = absoluteTickToViewportX(starts[m], viewport, song);
    measureNumbers.push({
      x: xBar + labelPadX,
      label: String(m + 1),
      measureIndex: m,
    });
  }

  return { barLines, gridLines, measureNumbers };
}

export interface DrawGridBackgroundOptions {
  /** When set with {@link gridContentWidthPx}, draws horizontal melody staff row lines (RA-1). */
  melodyRowHeight?: number;
  /** Width of the translated grid region (not including any left pitch gutter). */
  gridContentWidthPx?: number;
}

/**
 * Paints the grid background: light quarter-note lines, stronger measure bars, measure numbers in the header,
 * and optional horizontal row lines in the melody band (piano roll).
 */
export function drawGridBackground(
  ctx: CanvasRenderingContext2D,
  song: SongData,
  viewport: Viewport,
  canvasHeight: number,
  options?: DrawGridBackgroundOptions,
): void {
  const { barLines, gridLines, measureNumbers } = computeGridBackgroundLayout(song, viewport);

  ctx.save();

  ctx.lineWidth = 1;
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.beginPath();
  for (const x of gridLines) {
    const xi = Math.round(x) + 0.5;
    ctx.moveTo(xi, 0);
    ctx.lineTo(xi, canvasHeight);
  }
  ctx.stroke();

  ctx.strokeStyle = BAR_LINE_COLOR;
  ctx.beginPath();
  for (const x of barLines) {
    const xi = Math.round(x) + 0.5;
    ctx.moveTo(xi, 0);
    ctx.lineTo(xi, canvasHeight);
  }
  ctx.stroke();

  const rowH = options?.melodyRowHeight;
  const gridW = options?.gridContentWidthPx;
  if (rowH != null && gridW != null && gridW > 0) {
    const staffTop = noteStaffTopY();
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.beginPath();
    for (let r = 0; r <= MELODY_DIATONIC_ROW_COUNT; r++) {
      const y = Math.round(staffTop + r * rowH - viewport.scrollY) + 0.5;
      if (y < 0 || y > canvasHeight) {
        continue;
      }
      ctx.moveTo(0, y);
      ctx.lineTo(gridW, y);
    }
    ctx.stroke();
  }

  ctx.fillStyle = MEASURE_NUMBER_COLOR;
  ctx.font = MEASURE_NUMBER_FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const labelY = MEASURE_HEADER_HEIGHT / 2;
  for (const { x, label } of measureNumbers) {
    ctx.fillText(label, x, labelY);
  }

  ctx.restore();
}
