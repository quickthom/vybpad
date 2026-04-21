/**
 * TASK-7.5 — viewport transforms for zoom / vertical scroll (INTERFACES.md `Viewport`, PAT-012 layout).
 * Keeps zoom within editor limits; `scrollY` is clamped to a generous pitch-range window.
 */

import type { Viewport } from '@vybpad/shared';

import { NOTE_HEIGHT } from '../engine/renderer/constants';

export const MIN_EDITOR_ZOOM = 0.25;
export const MAX_EDITOR_ZOOM = 4;
export const DEFAULT_EDITOR_ZOOM = 1;
export const MIN_EDITOR_ZOOM_Y = 0.25;
export const MAX_EDITOR_ZOOM_Y = 4;
export const DEFAULT_EDITOR_ZOOM_Y = 1;

/** Multiplicative step per zoom in/out command (Hookpad-style discrete steps). */
const ZOOM_STEP_RATIO = 1.25;

/** One staff row per vertical scroll tick (matches {@link NOTE_HEIGHT} pitch ladder). */
export const EDITOR_SCROLL_STEP_Y = NOTE_HEIGHT;

const DEFAULT_MAX_SCROLL_Y = NOTE_HEIGHT * 120;

/** Legacy fallback for environments that still call {@link withScrollYDelta} without pitch-range context. */
export const MAX_SCROLL_Y = DEFAULT_MAX_SCROLL_Y;

function clampZoom(z: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(z)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, z));
}

function clampScrollY(y: number, maxScrollY = DEFAULT_MAX_SCROLL_Y): number {
  if (!Number.isFinite(y)) return 0;
  return Math.min(maxScrollY, Math.max(0, y));
}

export function withZoomIn(viewport: Viewport): Viewport {
  return { ...viewport, zoom: clampZoom(viewport.zoom * ZOOM_STEP_RATIO, MIN_EDITOR_ZOOM, MAX_EDITOR_ZOOM, DEFAULT_EDITOR_ZOOM) };
}

export function withZoomOut(viewport: Viewport): Viewport {
  return { ...viewport, zoom: clampZoom(viewport.zoom / ZOOM_STEP_RATIO, MIN_EDITOR_ZOOM, MAX_EDITOR_ZOOM, DEFAULT_EDITOR_ZOOM) };
}

export function withResetZoom(viewport: Viewport): Viewport {
  return { ...viewport, zoom: DEFAULT_EDITOR_ZOOM };
}

export function withZoomYIn(viewport: Viewport): Viewport {
  return {
    ...viewport,
    zoomY: clampZoom((viewport.zoomY ?? DEFAULT_EDITOR_ZOOM_Y) * ZOOM_STEP_RATIO, MIN_EDITOR_ZOOM_Y, MAX_EDITOR_ZOOM_Y, DEFAULT_EDITOR_ZOOM_Y),
  };
}

export function withZoomYOut(viewport: Viewport): Viewport {
  return {
    ...viewport,
    zoomY: clampZoom((viewport.zoomY ?? DEFAULT_EDITOR_ZOOM_Y) / ZOOM_STEP_RATIO, MIN_EDITOR_ZOOM_Y, MAX_EDITOR_ZOOM_Y, DEFAULT_EDITOR_ZOOM_Y),
  };
}

export function withZoomYReset(viewport: Viewport): Viewport {
  return { ...viewport, zoomY: DEFAULT_EDITOR_ZOOM_Y };
}

/**
 * Applies a vertical scroll delta and clamps to a bounded pitch-range viewport.
 *
 * For compatibility, `melodyRowCount` and `melodyRowHeight` are optional. When omitted,
 * the legacy 120-row clamp is used for callers that intentionally do not provide dynamic range
 * context.
 */
export function withScrollYDelta(
  viewport: Viewport,
  deltaY: number,
  melodyRowCount?: number,
  melodyRowHeight: number = NOTE_HEIGHT,
): Viewport {
  const rowHeight = Number.isFinite(melodyRowHeight) && melodyRowHeight > 0 ? melodyRowHeight : NOTE_HEIGHT;
  const maxRows =
    typeof melodyRowCount === 'number' && Number.isFinite(melodyRowCount)
      ? Math.max(0, Math.floor(melodyRowCount))
      : 0;
  const dynamicMax = maxRows > 0 ? maxRows * rowHeight : DEFAULT_MAX_SCROLL_Y;
  return { ...viewport, scrollY: clampScrollY(viewport.scrollY + deltaY, dynamicMax) };
}
