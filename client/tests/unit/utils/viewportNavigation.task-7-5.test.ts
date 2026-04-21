/**
 * TASK-7.5 — viewport zoom / vertical scroll semantics for `UIStore.viewport` (INTERFACES.md `Viewport`).
 *
 * QA exercises the live `viewportNavigation` module and documents bounds for horizontal and vertical zoom + scroll.
 */
import type { Viewport } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_ZOOM,
  DEFAULT_EDITOR_ZOOM_Y,
  MAX_EDITOR_ZOOM,
  MAX_EDITOR_ZOOM_Y,
  EDITOR_SCROLL_STEP_Y,
  MIN_EDITOR_ZOOM,
  MIN_EDITOR_ZOOM_Y,
  withResetZoom,
  withScrollYDelta,
  withZoomIn,
  withZoomOut,
  withZoomYIn,
  withZoomYOut,
  withZoomYReset,
} from '@/utils/viewportNavigation';

const baseVp: Viewport = { startMeasure: 0, measureCount: 8, scrollY: 40, zoom: 1, zoomY: 1 };

describe('TASK-7.5 — viewport navigation math (UIStore.viewport contract)', () => {
  it('clamps horizontal zoom in/out within min/max', () => {
    let v: Viewport = { ...baseVp, zoom: MIN_EDITOR_ZOOM };
    v = withZoomOut(v);
    expect(v.zoom).toBe(MIN_EDITOR_ZOOM);
    v = { ...baseVp, zoom: MAX_EDITOR_ZOOM };
    v = withZoomIn(v);
    expect(v.zoom).toBe(MAX_EDITOR_ZOOM);
  });

  it('clamps vertical zoom in/out within min/max', () => {
    let v: Viewport = { ...baseVp, zoomY: MIN_EDITOR_ZOOM_Y };
    v = withZoomYOut(v);
    expect(v.zoomY).toBe(MIN_EDITOR_ZOOM_Y);
    v = { ...baseVp, zoomY: MAX_EDITOR_ZOOM_Y };
    v = withZoomYIn(v);
    expect(v.zoomY).toBe(MAX_EDITOR_ZOOM_Y);
  });

  it('resetZoom restores default horizontal zoom', () => {
    const v = withResetZoom({ ...baseVp, zoom: 2.5, zoomY: 2 });
    expect(v.zoom).toBe(DEFAULT_EDITOR_ZOOM);
    expect(v.zoomY).toBe(2);
    expect(v.startMeasure).toBe(baseVp.startMeasure);
  });

  it('resetZoomY restores default vertical zoom without changing horizontal zoom', () => {
    const v = withZoomYReset({ ...baseVp, zoom: 2, zoomY: 2 });
    expect(v.zoomY).toBe(DEFAULT_EDITOR_ZOOM_Y);
  expect(v.zoom).toBe(2);
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

  it('clamps scrollY at dynamic max while preserving row height', () => {
    const v = withScrollYDelta({ ...baseVp, scrollY: 0 }, 1000, 10, 24);
    expect(v.scrollY).toBe(240);
    expect(v.scrollY).not.toBe(1000);
  });

  it('keeps zoomY unchanged while horizontal zoom changes and vice versa', () => {
    const v: Viewport = { ...baseVp, zoom: 1.5, zoomY: 1.5 };
    const afterHorizontal = withZoomIn(v);
    expect(afterHorizontal.zoom).toBe(1.875);
    expect(afterHorizontal.zoomY).toBe(1.5);
    const afterVertical = withZoomYIn(v);
    expect(afterVertical.zoomY).toBe(1.875);
    expect(afterVertical.zoom).toBe(1.5);
  });
});
