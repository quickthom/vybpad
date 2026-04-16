import type { ScaleDegree } from '@vybpad/shared';

import { NOTE_HEIGHT } from '../../engine/renderer/constants';
import { diatonicRowIndex, noteStaffTopY } from '../../engine/renderer/layout';

export { diatonicRowToDegreeAndOctave } from '../../engine/renderer/layout';

/** Trailing-edge resize hit (CSS / viewport pixels), aligned with UX §3 resize handle width. */
export const RESIZE_EDGE_PX = 8;

/**
 * Width of the trailing resize strip. Capped so narrow blocks still leave room for move drags
 * (PAT-012: a 96-tick chord at 1× zoom can be only ~8px wide — a full 8px strip would steal the whole block).
 */
export function trailingResizeStripWidthPx(blockWidthPx: number): number {
  if (!Number.isFinite(blockWidthPx) || blockWidthPx <= 0) return 0;
  const half = Math.floor(blockWidthPx / 2);
  return Math.min(RESIZE_EDGE_PX, Math.max(1, half));
}

/** Clicks shorter than this distance (px) count as selection, not drag. */
export const DRAG_THRESHOLD_PX = 4;

/**
 * Pointer `clientX` / `clientY` → canvas-local viewport `(x, y)` in the same space as
 * {@link hitTestEditorCanvas} and layout rects. Assumes the canvas backing store uses DPR scaling
 * and the 2D context is scaled so drawing uses CSS pixel units (see EditorCanvas resize handler).
 */
export function pointerEventToViewportXY(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  /** When the canvas reserves a left strip (e.g. pitch gutter), subtract so x aligns with grid space. */
  contentInsetLeft = 0,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const left = Number.isFinite(rect.left) ? rect.left : 0;
  const top = Number.isFinite(rect.top) ? rect.top : 0;
  return {
    x: clientX - left - contentInsetLeft,
    y: clientY - top,
  };
}

/**
 * `viewportY` on the canvas → staff-relative Y used by {@link noteRowY} (before subtracting scroll).
 */
export function viewportYToStaffRelativeY(viewportY: number, scrollY: number): number {
  return viewportY - noteStaffTopY() + scrollY;
}

/**
 * Inverse of `row * rowHeight + chromatic * (rowHeight/2)` (PAT-018): snap to the nearest
 * diatonic row + chromatic offset in {-1,0,1} by brute force over a small row window.
 */
export function nearestPitchGridFromStaffRelY(
  relY: number,
  rowHeight: number = NOTE_HEIGHT,
): {
  diatonicRow: number;
  chromatic: number;
} {
  const g = rowHeight / 2;
  let bestD = Infinity;
  let best = { diatonicRow: 0, chromatic: 0 };
  const rowLo = Math.max(0, Math.floor(relY / rowHeight) - 1);
  const rowHi = Math.ceil(relY / rowHeight) + 4;
  for (let row = rowLo; row <= rowHi; row++) {
    for (const chromatic of [-1, 0, 1] as const) {
      const y = row * rowHeight + chromatic * g;
      const d = Math.abs(relY - y);
      if (d < bestD) {
        bestD = d;
        best = { diatonicRow: row, chromatic };
      }
    }
  }
  return best;
}

export function degreeOctaveToDiatonicRow(scaleDegree: ScaleDegree, octave: number): number {
  return diatonicRowIndex(scaleDegree, octave);
}
