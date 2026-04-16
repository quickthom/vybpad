/**
 * Must stay aligned with `PITCH_GUTTER_WIDTH` in `client/src/engine/renderer/constants.ts` (RA-1).
 * Playwright `click({ position })` is relative to the canvas element; the left strip is not grid space.
 */
export const EDITOR_CANVAS_PITCH_GUTTER_PX = 40;

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
