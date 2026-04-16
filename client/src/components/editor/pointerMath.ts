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

/**
 * Classify pointer `vx` (grid X, same space as layout rects) against leading/trailing resize strips.
 * Leading uses the same strip width as trailing (UX §3 — 8px max, narrowed on small blocks).
 */
export function classifyHorizontalResizeEdge(
  blockLeftPx: number,
  blockWidthPx: number,
  vx: number,
): 'leading' | 'trailing' | null {
  const strip = trailingResizeStripWidthPx(blockWidthPx);
  if (strip <= 0) return null;
  const right = blockLeftPx + blockWidthPx;
  if (vx >= blockLeftPx && vx < blockLeftPx + strip) return 'leading';
  if (vx >= right - strip && vx <= right) return 'trailing';
  return null;
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

// --- OB-5 — soft magnetic snap (tick space; PAT-004 grid) ---

/**
 * Sixteenth-note step: beats (48) and even subdivisions (24, 12) align to this grid.
 * Matches PAT-004 “sixteenth note = 12 ticks”.
 */
export const MAGNETIC_SNAP_GRID_STEP_TICKS = 12;

/**
 * Pull toward the nearest grid line only when this close (ticks). Keeps motion free outside the band
 * (“gentle bump”, not hard grid lock). Chosen so {@link MAGNETIC_SNAP_GRID_STEP_TICKS} > 2 × threshold
 * (QA OB-5 — dead zone between snap lines).
 */
export const MAGNETIC_SNAP_THRESHOLD_TICKS = 4;

/**
 * Soft magnetic snap in measure-local tick space: if `tick` lies within {@link MAGNETIC_SNAP_THRESHOLD_TICKS}
 * of a multiple of {@link MAGNETIC_SNAP_GRID_STEP_TICKS} inside `[min, max]`, return that grid point; otherwise
 * return `tick` clamped to `[min, max]`.
 */
export function softMagneticSnapMeasureTick(
  tick: number,
  min: number,
  max: number,
  step: number = MAGNETIC_SNAP_GRID_STEP_TICKS,
  threshold: number = MAGNETIC_SNAP_THRESHOLD_TICKS,
): number {
  if (max < min) {
    return Math.round(tick);
  }
  let v = Math.round(tick);
  v = Math.max(min, Math.min(max, v));
  const kMin = Math.ceil(min / step);
  const kMax = Math.floor(max / step);
  if (kMin > kMax) {
    return v;
  }
  let best = v;
  let bestDist = Infinity;
  for (let k = kMin; k <= kMax; k++) {
    const s = k * step;
    const d = Math.abs(v - s);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  if (bestDist <= threshold) {
    return best;
  }
  return v;
}

/**
 * Measure-local beat / tick offset (0 … measureLengthTicks − 1): soft snap for QA contract and
 * move gestures. Invalid inputs yield a safe integer (0) so callers never propagate NaN.
 */
export function snapBeatMagnetically(beat: number, measureLengthTicks: number): number {
  if (!Number.isFinite(measureLengthTicks) || measureLengthTicks <= 0) {
    return 0;
  }
  if (!Number.isFinite(beat)) {
    return 0;
  }
  const maxTick = Math.max(0, Math.floor(measureLengthTicks) - 1);
  return softMagneticSnapMeasureTick(beat, 0, maxTick);
}
