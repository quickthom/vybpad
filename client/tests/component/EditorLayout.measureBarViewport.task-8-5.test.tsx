/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN - UI-R2-W5.4
 *
 * Criterion 1 - MeasureBar chunking on wide viewport.
 *   happy: when `computeMeasuresPerLine` is at least 2 for current viewport+zoom, `MeasureBar` renders >=2 rows.
 *   error: fixed viewport `measuresPerLine` leaves all cells in one row for wide layouts.
 *   edges: fixed song length 20+ and non-default `viewport.measureCount` seed.
 *
 * Criterion 2 - `measuresPerLine` safety for Task-8.0.
 *   happy: measure bar still renders without dropping rows when `viewport.measureCount` is non-positive.
 *
 * Criterion 3 - Monotonicity of row counts as viewport narrows.
 *   happy: with fixed song+zoom, narrowing window increases `MeasureBar` row count.
 */

import { type SongData } from '@vybpad/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { computeMeasuresPerLine } from '@/engine/renderer/measurePacking';
import { BEAT_WIDTH } from '@/engine/renderer/constants';
import { MeasureBar } from '@/components/MeasureBar';
import { EditorLayout } from '@/app/EditorLayout';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';

const PROJECT_ID = '00000000-0000-4000-8000-000000000001';
const WIDE_VIEWPORT_PX = 1280;
const NARROW_VIEWPORT_PX = 320;

function projectForSong(songData: SongData) {
  const now = new Date().toISOString();
  return {
    id: PROJECT_ID,
    name: 'UI-R2-W5.4',
    songData,
    createdAt: now,
    updatedAt: now,
  };
}

function makeSong(measureCount: number): SongData {
  const base = buildDefaultSong();
  const sourceMeasures = base.measures;
  return {
    ...base,
    measures: Array.from({ length: measureCount }, (_, index) => {
      const sourceMeasure = sourceMeasures[index % sourceMeasures.length];
      return {
        id: sourceMeasure.id + `-${index}`,
        chords: [],
        notes: [[], [], [], []],
      };
    }),
  };
}

function setWindowWidth(widthPx: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: widthPx,
  });
}

function expectedRows(measureCount: number, canvasWidthPx: number, zoom: number): number {
  const perLine = computeMeasuresPerLine({
    canvasWidthPx,
    zoom,
    beatWidthPx: BEAT_WIDTH,
  });
  return Math.max(1, Math.ceil(measureCount / perLine));
}

function measuredRows(): number {
  const regions = screen.getAllByRole('region', { name: 'Measures' });
  const bar = regions.at(-1);
  const track = bar?.querySelector('div');
  if (!track) {
    return 0;
  }
  return track.children.length;
}

function mockCanvasContext(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
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

function renderEditor(songData: SongData, widthPx: number): void {
  setWindowWidth(widthPx);
  const project = projectForSong(songData);

  render(
    <div style={{ width: `${widthPx}px` }}>
      <MemoryRouter initialEntries={[{ pathname: `/editor/${PROJECT_ID}`, state: { project } }]}>
        <Routes>
          <Route path="/editor/:projectId" element={<EditorLayout />} />
        </Routes>
      </MemoryRouter>
    </div>,
  );
}

beforeEach(() => {
  if (typeof window.requestAnimationFrame !== 'function') {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0) as unknown as number;
  }
  if (typeof window.cancelAnimationFrame !== 'function') {
    window.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );

  mockCanvasContext();
  setWindowWidth(WIDE_VIEWPORT_PX);
  useSongStore.getState().loadSong(makeSong(4));
  useUIStore
    .getState()
    .setViewport({ startMeasure: 0, measureCount: -1, scrollY: 0, zoom: 1 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('EditorLayout - responsive MeasureBar viewport wiring (UI-R2-W5.4)', () => {
  it('renders multiple MeasureBar rows when computeMeasuresPerLine returns >= 2', async () => {
    const songData = makeSong(24);
    useSongStore.getState().loadSong(songData);

    const expectedPerLine = computeMeasuresPerLine({
      canvasWidthPx: WIDE_VIEWPORT_PX,
      zoom: 1,
      beatWidthPx: BEAT_WIDTH,
    });
    const expected = expectedRows(songData.measures.length, WIDE_VIEWPORT_PX, 1);

    expect(expectedPerLine).toBeGreaterThanOrEqual(2);
    expect(expected).toBeGreaterThan(1);

    renderEditor(songData, WIDE_VIEWPORT_PX);
    await screen.findAllByRole('region', { name: 'Measures' });
    await waitFor(() => expect(measuredRows()).toBe(expected));
  });

  it('shows more MeasureBar rows after narrowing the viewport at fixed song+zoom', async () => {
    const songData = makeSong(24);
    useSongStore.getState().loadSong(songData);

    const expectedWide = expectedRows(songData.measures.length, WIDE_VIEWPORT_PX, 1);
    const expectedNarrow = expectedRows(songData.measures.length, NARROW_VIEWPORT_PX, 1);
    expect(expectedNarrow).toBeGreaterThan(expectedWide);

    renderEditor(songData, WIDE_VIEWPORT_PX);
    await screen.findAllByRole('region', { name: 'Measures' });
    await waitFor(() => expect(measuredRows()).toBe(expectedWide));
    const wideRows = measuredRows();

    cleanup();
    renderEditor(songData, NARROW_VIEWPORT_PX);
    await screen.findAllByRole('region', { name: 'Measures' });
    await waitFor(() => expect(measuredRows()).toBe(expectedNarrow));
    const narrowRows = measuredRows();

    expect(narrowRows).toBeGreaterThan(wideRows);
  });

  it('keeps measure rows stable when viewport.measureCount is set <= 0', async () => {
    const songData = makeSong(12);

    render(
      <MeasureBar
        measureCount={songData.measures.length}
        selectedMeasures={null}
        measuresPerLine={0}
        onSelectMeasure={vi.fn()}
        onSelectRange={vi.fn()}
        onAddMeasures={vi.fn()}
        onDeleteMeasures={vi.fn()}
      />,
    );
    const regions = await screen.findAllByRole('region', { name: 'Measures' });
    expect(regions.length).toBeGreaterThan(0);
    expect(measuredRows()).toBe(songData.measures.length);
  });
});
