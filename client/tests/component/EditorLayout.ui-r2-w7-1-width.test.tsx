/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-R2-W7.1
 *
 * Criterion 1 — Left rail default width lands in new target range and preserves center-column math.
 *   happy: left rail default is between UX §3 min (240px) and max (400px), and center width is 65–70%
 *     of a 1280px editor viewport when both side rails are default.
 *   error: legacy 288px-left default or default math that violates center-column target.
 *   edges: layout math uses 1280px target viewport when asserting acceptance ratio.
 *
 * Criterion 2 — Collapse-to-rail and resize handle behavior remain functional.
 *   happy: single click collapses chord rail to 48px, second click re-expands; drag handle clamps width to min/max.
 *   error: any failure to toggle width state or enforce bounds.
 *   edges: repeated toggles remain deterministic.
 */

import { EditorLayout } from '@/app/EditorLayout';
import { useAuthStore } from '@/store/authStore';
import { resetPlaybackStoreForTests } from '@/store/playbackStore';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VIEWPORT_WIDTH_PX = 1280;
const CENTER_COLUMN_MIN_RATIO = 0.65;
const CENTER_COLUMN_MAX_RATIO = 0.7;
const UX3_MIN_PANEL_PX = 240;
const UX3_MAX_PANEL_PX = 400;
const COLLAPSED_PANEL_WIDTH_PX = 48;

function parsePixelWidthFromElement(element: Element | null): number {
  if (!element) return Number.NaN;

  const styleWidth = element.getAttribute('style')?.match(/\bwidth:\s*(\d+)px/i);
  if (styleWidth) return Number.parseInt(styleWidth[1], 10);

  const tokens = (element.getAttribute('class') ?? '').split(/\s+/);
  const collapsed = tokens.find((token) => token === 'w-12');
  if (collapsed) return COLLAPSED_PANEL_WIDTH_PX;

  const fixedPxClass = tokens.find((token) => /\bw-\[\d+px\]/.test(token));
  if (fixedPxClass) {
    const match = fixedPxClass.match(/\[(\d+)px\]/);
    if (match) return Number.parseInt(match[1], 10);
  }

  return Number.NaN;
}

function renderEditorAtLocalEditor(): void {
  render(
    <MemoryRouter initialEntries={['/editor']}>
      <Routes>
        <Route path="/editor" element={<EditorLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubCanvas2d(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId) => {
    if (contextId !== '2d') {
      return null;
    }
    return {
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      clip: vi.fn(),
      translate: vi.fn(),
      setTransform: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      arcTo: vi.fn(),
      roundRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  });
}

function chordPalettePanel(): HTMLElement | null {
  return document.querySelector('#vybpad-panel-chords');
}

function chordPaletteRow(): HTMLElement | null {
  return chordPalettePanel()?.parentElement ?? null;
}

function leftPanelWidthPx(): number {
  return parsePixelWidthFromElement(chordPalettePanel());
}

function rightPanelWidthPx(): number {
  const rowChildren = chordPaletteRow()?.children;
  return parsePixelWidthFromElement(rowChildren && rowChildren[2] instanceof HTMLElement ? rowChildren[2] : null);
}

function resizeHandle(): HTMLElement {
  return screen.getByTestId('vybpad-panel-chords-resize-handle');
}

beforeEach(() => {
  stubCanvas2d();
  resetPlaybackStoreForTests();
  useSongStore.getState().loadSong(buildDefaultSong());
  useUIStore.setState({
    activePanels: new Set<string>(),
    entryMode: 'table',
  });
  useAuthStore.setState({
    user: {
      id: 'qa-user-id',
      email: 'qa@example.com',
      displayName: 'QA',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    accessToken: 'qa-token',
    isAuthenticated: true,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('UI-R2-W7.1 — criterion 1: left panel default width + center allocation', () => {
  it('reports left panel default between 240px and 400px and keeps center near 65–70% at 1280px', () => {
    renderEditorAtLocalEditor();

    const leftWidth = leftPanelWidthPx();
    const rightWidth = rightPanelWidthPx();

    expect(leftWidth, 'left rail must be parseable').toBeGreaterThan(0);
    expect(rightWidth, 'right rail must be parseable').toBeGreaterThan(0);
    expect(leftWidth, 'left rail should stay below legacy 288px default').toBeLessThan(288);
    expect(leftWidth, 'left rail should satisfy UX §3 minimum').toBeGreaterThanOrEqual(UX3_MIN_PANEL_PX);
    expect(leftWidth, 'left rail should satisfy UX §3 maximum').toBeLessThanOrEqual(UX3_MAX_PANEL_PX);

    const centerWidth = VIEWPORT_WIDTH_PX - leftWidth - rightWidth;
    expect(centerWidth, 'center width target at 1280px').toBeGreaterThanOrEqual(
      Math.round(VIEWPORT_WIDTH_PX * CENTER_COLUMN_MIN_RATIO),
    );
    expect(centerWidth, 'center width target at 1280px').toBeLessThanOrEqual(
      Math.round(VIEWPORT_WIDTH_PX * CENTER_COLUMN_MAX_RATIO),
    );
  });
});

describe('UI-R2-W7.1 — criterion 2: collapse/expand and resize handle behavior', () => {
  it('collapses to 48px and expands back to a non-legacy default width on repeated clicks', async () => {
    const user = userEvent.setup();
    renderEditorAtLocalEditor();

    const toggle = screen.getByRole('button', { name: 'Chords' });
    const leftExpanded = leftPanelWidthPx();
    expect(leftExpanded).toBeGreaterThan(COLLAPSED_PANEL_WIDTH_PX);

    await user.click(toggle);
    const leftCollapsed = leftPanelWidthPx();
    expect(leftCollapsed, 'collapsed chord rail should be 48px').toBe(COLLAPSED_PANEL_WIDTH_PX);

    await user.click(toggle);
    const leftReexpanded = leftPanelWidthPx();
    expect(leftReexpanded, 'expanded chord rail should be above collapsed width').toBeGreaterThan(COLLAPSED_PANEL_WIDTH_PX);
    expect(leftReexpanded).toBeLessThan(288);

    await user.click(toggle);
    await user.click(toggle);
    const leftAfterTwoCycles = leftPanelWidthPx();
    expect(leftAfterTwoCycles, 'repeated toggles should restore to expanded state').toBeGreaterThan(COLLAPSED_PANEL_WIDTH_PX);
  });

  it('supports resize-handle drag and clamps width to UX §3 bounds', () => {
    renderEditorAtLocalEditor();
    const handle = resizeHandle();

    const initialWidth = leftPanelWidthPx();
    expect(initialWidth, 'initial left width should be parseable').toBeGreaterThan(0);

    fireEvent.mouseDown(handle, { button: 0, clientX: 100 });
    fireEvent(window, new MouseEvent('mousemove', { bubbles: true, clientX: 560 }));
    fireEvent(window, new MouseEvent('mouseup', { bubbles: true, clientX: 560 }));
    const afterGrow = leftPanelWidthPx();
    expect(afterGrow, 'left width should clamp at or below the 400px max').toBeLessThanOrEqual(UX3_MAX_PANEL_PX);

    fireEvent.mouseDown(handle, { button: 0, clientX: 560 });
    fireEvent(window, new MouseEvent('mousemove', { bubbles: true, clientX: 80 }));
    fireEvent(window, new MouseEvent('mouseup', { bubbles: true, clientX: 80 }));
    const afterShrink = leftPanelWidthPx();
    expect(afterShrink, 'left width should clamp at or above the 240px min').toBeGreaterThanOrEqual(UX3_MIN_PANEL_PX);
  });
});
