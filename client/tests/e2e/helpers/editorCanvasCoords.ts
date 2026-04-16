import { CHORD_AREA_HEIGHT, MEASURE_HEADER_HEIGHT, NOTE_HEIGHT } from '../../../src/engine/renderer/constants';

/**
 * Must stay aligned with `PITCH_GUTTER_WIDTH` in `client/src/engine/renderer/constants.ts` (RA-1).
 * Playwright `click({ position })` is relative to the canvas element; the left strip is not grid space.
 */
export const EDITOR_CANVAS_PITCH_GUTTER_PX = 40;

/** Vertical center of the bottom chord track strip (RA-2 / PAT-012) for a canvas of this CSS height. */
export function editorChordStripCenterY(canvasHeightCssPx: number): number {
  return canvasHeightCssPx - CHORD_AREA_HEIGHT / 2;
}

/** Approximate center Y of row-0 melody note blocks at default staff spacing (PAT-012 NOTE_HEIGHT). */
export function editorMelodyRow0ApproxCenterY(): number {
  return MEASURE_HEADER_HEIGHT + NOTE_HEIGHT / 2;
}

/**
 * X coordinate in canvas pixels that lands in the scrollable grid (past the pitch gutter).
 * `gridFraction` applies to the width **after** the gutter; `minPaddingPx` is extra padding inside the grid from x=0.
 */
export function editorGridPointerX(
  canvasWidth: number,
  gridFraction: number,
  minPaddingPx = 16,
): number {
  const g = EDITOR_CANVAS_PITCH_GUTTER_PX;
  const gridW = Math.max(0, canvasWidth - g);
  return Math.min(Math.max(g + minPaddingPx, g + gridW * gridFraction), canvasWidth - 8);
}
