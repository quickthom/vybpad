/**
 * TASK-7.5 — viewport transforms for zoom / vertical scroll (INTERFACES.md `Viewport`, PAT-012 layout).
 * Keeps zoom within editor limits; `scrollY` is clamped to a generous pitch-range window.
 */

import type { Viewport } from '@vybpad/shared';

import { NOTE_HEIGHT } from '../engine/renderer/constants';

export const MIN_EDITOR_ZOOM = 0.25;
export const MAX_EDITOR_ZOOM = 4;
export const DEFAULT_EDITOR_ZOOM = 1;

/** Multiplicative step per zoom in/out command (Hookpad-style discrete steps). */
const ZOOM_STEP_RATIO = 1.25;

/** One staff row per vertical scroll tick (matches {@link NOTE_HEIGHT} pitch ladder). */
export const EDITOR_SCROLL_STEP_Y = NOTE_HEIGHT;

const MAX_SCROLL_Y = NOTE_HEIGHT * 120;

function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return DEFAULT_EDITOR_ZOOM;
  return Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, z));
}

function clampScrollY(y: number): number {
  if (!Number.isFinite(y)) return 0;
  return Math.min(MAX_SCROLL_Y, Math.max(0, y));
}

export function withZoomIn(viewport: Viewport): Viewport {
  return { ...viewport, zoom: clampZoom(viewport.zoom * ZOOM_STEP_RATIO) };
}

export function withZoomOut(viewport: Viewport): Viewport {
  return { ...viewport, zoom: clampZoom(viewport.zoom / ZOOM_STEP_RATIO) };
}

export function withResetZoom(viewport: Viewport): Viewport {
  return { ...viewport, zoom: DEFAULT_EDITOR_ZOOM };
}

export function withScrollYDelta(viewport: Viewport, deltaY: number): Viewport {
  return { ...viewport, scrollY: clampScrollY(viewport.scrollY + deltaY) };
}
