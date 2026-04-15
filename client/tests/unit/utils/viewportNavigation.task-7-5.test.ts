/**
 * TASK-7.5 — viewport zoom / vertical scroll semantics for `UIStore.viewport` (INTERFACES.md `Viewport`).
 *
 * Mirrors the behavior that {@link client/src/utils/viewportNavigation.ts} will implement once landed;
 * QA duplicates the pure math here so this suite runs before that module exists and still documents bounds.
 */
import { describe, expect, it } from 'vitest';

import type { Viewport } from '@vybpad/shared';

import { NOTE_HEIGHT } from '@/engine/renderer/constants';

const MIN_EDITOR_ZOOM = 0.25;
const MAX_EDITOR_ZOOM = 4;
const DEFAULT_EDITOR_ZOOM = 1;
const ZOOM_STEP_RATIO = 1.25;
const EDITOR_SCROLL_STEP_Y = NOTE_HEIGHT;
const MAX_SCROLL_Y = NOTE_HEIGHT * 120;

function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return DEFAULT_EDITOR_ZOOM;
  return Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, z));
}

function clampScrollY(y: number): number {
  if (!Number.isFinite(y)) return 0;
  return Math.min(MAX_SCROLL_Y, Math.max(0, y));
}

function withZoomIn(viewport: Viewport): Viewport {
  return { ...viewport, zoom: clampZoom(viewport.zoom * ZOOM_STEP_RATIO) };
}

function withZoomOut(viewport: Viewport): Viewport {
  return { ...viewport, zoom: clampZoom(viewport.zoom / ZOOM_STEP_RATIO) };
}

function withResetZoom(viewport: Viewport): Viewport {
  return { ...viewport, zoom: DEFAULT_EDITOR_ZOOM };
}

function withScrollYDelta(viewport: Viewport, deltaY: number): Viewport {
  return { ...viewport, scrollY: clampScrollY(viewport.scrollY + deltaY) };
}

const baseVp: Viewport = { startMeasure: 0, measureCount: 8, scrollY: 40, zoom: 1 };

describe('TASK-7.5 — viewport navigation math (UIStore.viewport contract)', () => {
  it('clamps zoom in/out within min/max', () => {
    let v: Viewport = { ...baseVp, zoom: MIN_EDITOR_ZOOM };
    v = withZoomOut(v);
    expect(v.zoom).toBe(MIN_EDITOR_ZOOM);
    v = { ...baseVp, zoom: MAX_EDITOR_ZOOM };
    v = withZoomIn(v);
    expect(v.zoom).toBe(MAX_EDITOR_ZOOM);
  });

  it('resetZoom restores default horizontal zoom', () => {
    const v = withResetZoom({ ...baseVp, zoom: 2.5 });
    expect(v.zoom).toBe(DEFAULT_EDITOR_ZOOM);
    expect(v.startMeasure).toBe(baseVp.startMeasure);
  });

  it('scrollUp decreases scrollY and scrollDown increases it', () => {
    const up = withScrollYDelta(baseVp, -EDITOR_SCROLL_STEP_Y);
    expect(up.scrollY).toBe(baseVp.scrollY - EDITOR_SCROLL_STEP_Y);
    const down = withScrollYDelta(baseVp, EDITOR_SCROLL_STEP_Y);
    expect(down.scrollY).toBe(baseVp.scrollY + EDITOR_SCROLL_STEP_Y);
  });

  it('clamps scrollY at zero', () => {
    const v = withScrollYDelta({ ...baseVp, scrollY: 5 }, -100);
    expect(v.scrollY).toBe(0);
  });
});
