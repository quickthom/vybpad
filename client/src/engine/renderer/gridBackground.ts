import type { ScaleDegree, SongData, Viewport } from '@vybpad/shared';

import { CHORD_LETTER_STRIP_HEIGHT, MELODY_DIATONIC_ROW_COUNT } from './constants';
import { pat010DiatonicHex } from './colorMaps';
import {
  absoluteTickToViewportX,
  BAR_LINE_COLOR,
  bottomChordStripTopY,
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
  /** Number of melody staff rows to render before the chord strip. */
  melodyRowCount?: number;
  /** Width of the translated grid region (not including any left pitch gutter). */
  gridContentWidthPx?: number;
}

function blendPat010Fill(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const br = Math.round(255 * (1 - alpha) + r * alpha);
  const bg = Math.round(255 * (1 - alpha) + g * alpha);
  const bb = Math.round(255 * (1 - alpha) + b * alpha);
  return `rgb(${br},${bg},${bb})`;
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

  const rowH = options?.melodyRowHeight;
  const melodyRows = options?.melodyRowCount ?? MELODY_DIATONIC_ROW_COUNT;
  const gridW = options?.gridContentWidthPx;
  if (rowH != null && gridW != null && gridW > 0) {
    const stripTop = bottomChordStripTopY(rowH, melodyRows);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, stripTop, gridW, CHORD_LETTER_STRIP_HEIGHT);
  }

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

  if (rowH != null && gridW != null && gridW > 0) {
    const staffTop = noteStaffTopY();
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.beginPath();
    for (let r = 0; r <= melodyRows; r++) {
      const y = Math.round(staffTop + r * rowH - viewport.scrollY) + 0.5;
      if (y < 0 || y > canvasHeight) {
        continue;
      }
      ctx.moveTo(0, y);
      ctx.lineTo(gridW, y);
    }
    ctx.stroke();

    for (let r = 0; r < melodyRows; r++) {
      const degree = (((r % 7) + 1) as unknown) as ScaleDegree;
      const yTop = staffTop + r * rowH - viewport.scrollY;
      const yBottom = yTop + rowH;
      if (yBottom <= 0 || yTop >= canvasHeight) {
        continue;
      }
      const tintFill = blendPat010Fill(pat010DiatonicHex(degree), 0.08);
      ctx.fillStyle = tintFill;
      ctx.fillRect(0, yTop, gridW, rowH);
    }
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
