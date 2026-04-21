/**
 * TASK-7.5 — viewport zoom / vertical scroll semantics for `UIStore.viewport` (INTERFACES.md `Viewport`).
 */
import { describe, expect, it } from 'vitest';

import type { Viewport } from '@vybpad/shared';

import { NOTE_HEIGHT } from '@/engine/renderer/constants';
import * as viewportNavigation from '@/utils/viewportNavigation';

const MIN_EDITOR_ZOOM = viewportNavigation.MIN_EDITOR_ZOOM ?? 0.25;
const MAX_EDITOR_ZOOM = viewportNavigation.MAX_EDITOR_ZOOM ?? 4;
const DEFAULT_EDITOR_ZOOM = viewportNavigation.DEFAULT_EDITOR_ZOOM ?? 1;
const ZOOM_STEP_RATIO = viewportNavigation.ZOOM_STEP_RATIO ?? 1.25;
const EDITOR_SCROLL_STEP_Y = viewportNavigation.EDITOR_SCROLL_STEP_Y ?? NOTE_HEIGHT;
const MAX_SCROLL_Y = viewportNavigation.MAX_SCROLL_Y ?? NOTE_HEIGHT * 120;
const MIN_EDITOR_ZOOM_Y = viewportNavigation.MIN_EDITOR_ZOOM_Y ?? MIN_EDITOR_ZOOM;
const MAX_EDITOR_ZOOM_Y = viewportNavigation.MAX_EDITOR_ZOOM_Y ?? MAX_EDITOR_ZOOM;
const DEFAULT_EDITOR_ZOOM_Y = viewportNavigation.DEFAULT_EDITOR_ZOOM_Y ?? 1;

const baseVp: Viewport = { startMeasure: 0, measureCount: 8, scrollY: 40, zoom: 1 };

describe('TASK-7.5 — viewport navigation math (UIStore.viewport contract)', () => {
  it('clamps zoom in/out within min/max', () => {
    let v: Viewport = { ...baseVp, zoom: MIN_EDITOR_ZOOM };
    v = viewportNavigation.withZoomOut(v);
    expect(v.zoom).toBe(MIN_EDITOR_ZOOM);
    v = { ...baseVp, zoom: MAX_EDITOR_ZOOM };
    v = viewportNavigation.withZoomIn(v);
    expect(v.zoom).toBe(MAX_EDITOR_ZOOM);
  });

  it('resetZoom restores default horizontal zoom', () => {
    const v = viewportNavigation.withResetZoom({ ...baseVp, zoom: 2.5 });
    expect(v.zoom).toBe(DEFAULT_EDITOR_ZOOM);
    expect(v.startMeasure).toBe(baseVp.startMeasure);
  });

  it('scrollUp decreases scrollY and scrollDown increases it', () => {
    const up = viewportNavigation.withScrollYDelta(baseVp, -EDITOR_SCROLL_STEP_Y);
    expect(up.scrollY).toBe(baseVp.scrollY - EDITOR_SCROLL_STEP_Y);
    const down = viewportNavigation.withScrollYDelta(baseVp, EDITOR_SCROLL_STEP_Y);
    expect(down.scrollY).toBe(baseVp.scrollY + EDITOR_SCROLL_STEP_Y);
  });

  it('clamps scrollY at zero', () => {
    const v = viewportNavigation.withScrollYDelta({ ...baseVp, scrollY: 5 }, -100);
    expect(v.scrollY).toBe(0);
  });

  it('clamps scrollY to the expected max bound', () => {
    const maxRowBound = { ...baseVp, scrollY: MAX_SCROLL_Y - 1 };
    const v = viewportNavigation.withScrollYDelta(maxRowBound, 10000);
    expect(v.scrollY).toBeLessThanOrEqual(MAX_SCROLL_Y);
  });

  it('exposes and clamps new vertical zoom helpers for zoomY', () => {
    expect(typeof viewportNavigation.withZoomYIn).toBe('function');
    expect(typeof viewportNavigation.withZoomYOut).toBe('function');
    expect(typeof viewportNavigation.withResetZoomY).toBe('function');

    const withZoomYIn = viewportNavigation.withZoomYIn as (v: Viewport) => Viewport;
    const withZoomYOut = viewportNavigation.withZoomYOut as (v: Viewport) => Viewport;
    const withResetZoomY = viewportNavigation.withResetZoomY as (v: Viewport) => Viewport;

    expect(withZoomYIn({ ...baseVp, zoomY: MIN_EDITOR_ZOOM_Y }).zoomY).toBe(MIN_EDITOR_ZOOM_Y);
    expect(withZoomYOut({ ...baseVp, zoomY: MAX_EDITOR_ZOOM_Y }).zoomY).toBe(MAX_EDITOR_ZOOM_Y);
    expect(withResetZoomY({ ...baseVp, zoomY: 2.5, zoom: 2.5 }).zoomY).toBe(DEFAULT_EDITOR_ZOOM_Y);
  });

  it('normalizes invalid zoomY to default and keeps horizontal zoom untouched', () => {
    const withZoomYIn = viewportNavigation.withZoomYIn as (v: Viewport) => Viewport;
    const withResetZoomY = viewportNavigation.withResetZoomY as (v: Viewport) => Viewport;

    const normalized = withZoomYIn({ ...baseVp });
    expect(normalized.zoomY).toBe(DEFAULT_EDITOR_ZOOM_Y);
    expect(normalized.zoom).toBe(baseVp.zoom);

    const invalidValue = withResetZoomY({ ...baseVp, zoomY: Number.NaN, zoom: 3 });
    expect(invalidValue.zoomY).toBe(DEFAULT_EDITOR_ZOOM_Y);
  });
});
