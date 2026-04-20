import { BEAT_WIDTH } from './constants';

export interface ComputeMeasuresPerLineArgs {
  /** Available editor-grid width in CSS pixels (before measure header reservations). */
  canvasWidthPx: number;
  /** Horizontal zoom multiplier (PAT-012). */
  zoom: number;
  /** Base beat width in pixels at zoom 1.0 (PAT-012 `BEAT_WIDTH`). */
  beatWidthPx?: number;
  /** Optional reserved width in px (defaults to 0, callers may pass `MEASURE_HEADER_HEIGHT` for spacing parity). */
  measureHeaderHeightPx?: number;
  /** Beats per measure (defaults to common time). */
  beatsPerMeasure?: number;
}

/**
 * Computes the number of full measures that fit in one row.
 *
 * - Rounds down via `Math.floor` so only full measures are counted.
 * - Clamps to at least `1` (same safe-floor guard as TASK-8.0 `MeasureBar` stride behavior).
 * - Monotonic expectation: narrower widths or larger zoom should not increase the result.
 */
export function computeMeasuresPerLine({
  canvasWidthPx,
  zoom,
  beatWidthPx = BEAT_WIDTH,
  measureHeaderHeightPx = 0,
  beatsPerMeasure = 4,
}: ComputeMeasuresPerLineArgs): number {
  const safeCanvasWidth = Number.isFinite(canvasWidthPx) ? Math.max(0, canvasWidthPx) : 0;
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const safeBeatWidth = Number.isFinite(beatWidthPx) && beatWidthPx > 0 ? beatWidthPx : BEAT_WIDTH;
  const safeBeatsPerMeasure = Number.isFinite(beatsPerMeasure)
    ? Math.max(1, Math.floor(beatsPerMeasure))
    : 4;
  const safeHeader = Number.isFinite(measureHeaderHeightPx) && measureHeaderHeightPx > 0 ? measureHeaderHeightPx : 0;

  const availableWidth = Math.max(0, safeCanvasWidth - safeHeader);
  const perMeasureWidth = safeBeatsPerMeasure * safeBeatWidth * safeZoom;

  if (perMeasureWidth <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor(availableWidth / perMeasureWidth));
}
