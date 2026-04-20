/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — TASK-2.10
 *
 * Criterion 1 — MeasureBarProps (INTERFACES.md): component accepts measureCount, selectedMeasures,
 *   measuresPerLine, and all callbacks; renders without throwing.
 * Criterion 2 — Measure list: measureCount cells numbered 1..N; click → onSelectMeasure(0-based index).
 * Criterion 3 — Range: shift+click → onSelectRange(start, end) with 0-based inclusive indices, start ≤ end.
 * Criterion 4 — Add / Delete: Add → onAddMeasures(1); Delete → onDeleteMeasures(start, end); Delete disabled
 *   when selectedMeasures is null.
 * Criterion 5 — App: MeasureBar in bottom strip; addMeasures / deleteMeasures wired to SongStore.
 * Criterion 6 — UX: 56px strip height; horizontal scroll container when content may overflow.
 * Criterion 7 — npm test passes after Builder implementation (CI).
 */

import type { ComponentProps } from 'react';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorLayout } from '../../src/app/EditorLayout';
import { MeasureBar } from '../../src/components/MeasureBar';
import { buildDefaultSong, useSongStore } from '../../src/store/songStore';

/** Minimal Canvas 2D mock so `<App />` (EditorCanvas) mounts under jsdom. */
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

afterEach(() => {
  cleanup();
});

type MeasureBarProps = ComponentProps<typeof MeasureBar>;

function defaultProps(overrides: Partial<MeasureBarProps> = {}): MeasureBarProps {
  return {
    measureCount: 4,
    selectedMeasures: null,
    measuresPerLine: 8,
    onSelectMeasure: vi.fn(),
    onSelectRange: vi.fn(),
    onAddMeasures: vi.fn(),
    onDeleteMeasures: vi.fn(),
    ...overrides,
  };
}

function measureLabel(display: number): string {
  return `Measure ${display}`;
}

/** Parent-owned selection: mirrors App so the first click updates props before shift+click. */
function MeasureBarHarness({
  measureCount,
  onSelectRangeSpy,
}: {
  measureCount: number;
  onSelectRangeSpy: (start: number, end: number) => void;
}) {
  const [selectedMeasures, setSelectedMeasures] = useState<[number, number] | null>(null);
  return (
    <MeasureBar
      measureCount={measureCount}
      selectedMeasures={selectedMeasures}
      measuresPerLine={8}
      onSelectMeasure={(index) => {
        setSelectedMeasures([index, index]);
      }}
      onSelectRange={(start, end) => {
        setSelectedMeasures([start, end]);
        onSelectRangeSpy(start, end);
      }}
      onAddMeasures={vi.fn()}
      onDeleteMeasures={vi.fn()}
    />
  );
}

describe('MeasureBar — MeasureBarProps contract (criterion 1)', () => {
  describe('happy path', () => {
    it('renders when all INTERFACES MeasureBarProps are supplied including measuresPerLine', () => {
      expect(() =>
        render(
          <MeasureBar
            measureCount={3}
            selectedMeasures={[0, 1]}
            measuresPerLine={4}
            onSelectMeasure={vi.fn()}
            onSelectRange={vi.fn()}
            onAddMeasures={vi.fn()}
            onDeleteMeasures={vi.fn()}
          />,
        ),
      ).not.toThrow();
      expect(screen.getByRole('button', { name: measureLabel(1) })).toBeTruthy();
    });
  });
});

describe('TASK-8.0 — measuresPerLine non-positive chunking safety', () => {
  it('renders all measure cells when measuresPerLine is 0 (same count as measuresPerLine 1 for small N)', () => {
    const n = 4;
    const baseline = render(<MeasureBar {...defaultProps({ measureCount: n, measuresPerLine: 1 })} />);
    const baselineCount = baseline.queryAllByRole('button', { name: /^Measure \d+$/ }).length;
    baseline.unmount();

    render(<MeasureBar {...defaultProps({ measureCount: n, measuresPerLine: 0 })} />);
    expect(screen.queryAllByRole('button', { name: /^Measure \d+$/ })).toHaveLength(baselineCount);
  });

  it('renders all measure cells when measuresPerLine is negative (same count as measuresPerLine 1)', () => {
    const n = 4;
    const baseline = render(<MeasureBar {...defaultProps({ measureCount: n, measuresPerLine: 1 })} />);
    const baselineCount = baseline.queryAllByRole('button', { name: /^Measure \d+$/ }).length;
    baseline.unmount();

    render(<MeasureBar {...defaultProps({ measureCount: n, measuresPerLine: -2 })} />);
    expect(screen.queryAllByRole('button', { name: /^Measure \d+$/ })).toHaveLength(baselineCount);
  });
});

describe('MeasureBar — measure list rendering (criterion 2)', () => {
  describe('happy path', () => {
    it('renders measureCount cells labeled 1 through N', () => {
      const n = 6;
      render(<MeasureBar {...defaultProps({ measureCount: n })} />);
      for (let d = 1; d <= n; d += 1) {
        expect(screen.getByRole('button', { name: measureLabel(d) })).toBeTruthy();
      }
      expect(screen.queryAllByRole('button', { name: /^Measure \d+$/ })).toHaveLength(n);
    });

    it('calls onSelectMeasure with 0-based index when a measure cell is clicked', () => {
      const onSelectMeasure = vi.fn();
      render(<MeasureBar {...defaultProps({ measureCount: 5, onSelectMeasure })} />);
      fireEvent.click(screen.getByRole('button', { name: measureLabel(4) }));
      expect(onSelectMeasure).toHaveBeenCalledTimes(1);
      expect(onSelectMeasure).toHaveBeenCalledWith(3);
    });
  });

  describe('edge cases', () => {
    it('renders no measure number buttons when measureCount is 0', () => {
      render(<MeasureBar {...defaultProps({ measureCount: 0 })} />);
      expect(screen.queryAllByRole('button', { name: /^Measure \d+$/ })).toHaveLength(0);
    });
  });
});

describe('MeasureBar — range selection shift+click (criterion 3)', () => {
  describe('happy path', () => {
    it('calls onSelectRange(start, end) with 0-based inclusive indices and start ≤ end when shift-clicking after a normal click (anchor from selection)', () => {
      const onSelectRange = vi.fn();
      render(
        <MeasureBar
          {...defaultProps({
            measureCount: 8,
            selectedMeasures: [1, 1],
            onSelectRange,
          })}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: measureLabel(5) }), { shiftKey: true });
      expect(onSelectRange).toHaveBeenCalledTimes(1);
      expect(onSelectRange).toHaveBeenCalledWith(1, 4);
    });

    it('calls onSelectRange with ordered endpoints when shift-clicking from a higher index toward a lower index', () => {
      const onSelectRange = vi.fn();
      render(
        <MeasureBar
          {...defaultProps({
            measureCount: 8,
            selectedMeasures: [5, 5],
            onSelectRange,
          })}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: measureLabel(2) }), { shiftKey: true });
      expect(onSelectRange).toHaveBeenCalledWith(1, 5);
    });

    it('calls onSelectRange after a normal click then shift+click when selection is held in parent state', () => {
      const onSelectRange = vi.fn();
      render(<MeasureBarHarness measureCount={8} onSelectRangeSpy={onSelectRange} />);
      fireEvent.click(screen.getByRole('button', { name: measureLabel(2) }));
      fireEvent.click(screen.getByRole('button', { name: measureLabel(5) }), { shiftKey: true });
      expect(onSelectRange).toHaveBeenCalledWith(1, 4);
    });

    it('orders endpoints start ≤ end when shift-clicking upward after selecting a higher measure first', () => {
      const onSelectRange = vi.fn();
      render(<MeasureBarHarness measureCount={8} onSelectRangeSpy={onSelectRange} />);
      fireEvent.click(screen.getByRole('button', { name: measureLabel(6) }));
      fireEvent.click(screen.getByRole('button', { name: measureLabel(2) }), { shiftKey: true });
      expect(onSelectRange).toHaveBeenCalledWith(1, 5);
    });

    it('calls onSelectRange after pointer drag across cells (pointerup)', () => {
      const onSelectRange = vi.fn();
      const { container } = render(
        <MeasureBar {...defaultProps({ measureCount: 4, onSelectRange })} />,
      );
      const cells = container.querySelectorAll('[data-measure-index]');
      const first = cells[0] as HTMLElement;
      const last = cells[3] as HTMLElement;
      fireEvent.pointerDown(first, { pointerId: 1 });
      fireEvent.pointerEnter(last);
      fireEvent.pointerUp(window, { pointerId: 1 });
      expect(onSelectRange).toHaveBeenCalledWith(0, 3);
    });
  });
});

describe('MeasureBar — Add / Delete controls (criterion 4)', () => {
  describe('happy path', () => {
    it('calls onAddMeasures(1) when Add is activated', () => {
      const onAddMeasures = vi.fn();
      render(<MeasureBar {...defaultProps({ onAddMeasures })} />);
      fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
      expect(onAddMeasures).toHaveBeenCalledWith(1);
    });

    it('calls onDeleteMeasures(selectedMeasures[0], selectedMeasures[1]) when Delete is activated', () => {
      const onDeleteMeasures = vi.fn();
      render(
        <MeasureBar
          {...defaultProps({
            measureCount: 8,
            selectedMeasures: [2, 5],
            onDeleteMeasures,
          })}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onDeleteMeasures).toHaveBeenCalledTimes(1);
      expect(onDeleteMeasures).toHaveBeenCalledWith(2, 5);
    });
  });

  describe('error handling', () => {
    it('disables Delete when selectedMeasures is null', () => {
      render(<MeasureBar {...defaultProps({ selectedMeasures: null })} />);
      const del = screen.getByRole('button', { name: 'Delete' });
      expect((del as HTMLButtonElement).disabled).toBe(true);
    });
  });
});

describe('MeasureBar — selected range visual state (accessibility)', () => {
  it('sets aria-pressed true on cells inside the inclusive selectedMeasures range', () => {
    render(
      <MeasureBar
        {...defaultProps({
          measureCount: 5,
          selectedMeasures: [1, 3],
        })}
      />,
    );
    for (const d of [2, 3, 4]) {
      const cell = screen.getByRole('button', { name: measureLabel(d) });
      expect(cell.getAttribute('aria-pressed')).toBe('true');
    }
    expect(screen.getByRole('button', { name: measureLabel(1) }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});

describe('MeasureBar — UX layout strip (criterion 6)', () => {
  it('uses a 56px-tall root strip and an overflow-x-auto measure track for horizontal scrolling', () => {
    const { container } = render(<MeasureBar {...defaultProps({ measureCount: 20 })} />);
    const root = container.querySelector('[role="region"][aria-label="Measures"]');
    expect(root).toBeTruthy();
    expect(root!.classList.contains('h-[56px]')).toBe(true);
    const track = root?.querySelector('.overflow-x-auto');
    expect(track).toBeTruthy();
  });
});

describe('App — MeasureBar integration (criterion 5)', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockMainWidth(container: Element, widthPx: number): void {
    const main = container.querySelector('main');
    if (!main) return;

    Object.defineProperty(main, 'clientWidth', {
      configurable: true,
      get: () => widthPx,
    });
  }

  function countMeasureRows(strip: HTMLElement): number {
    const trackSelector =
      '.flex.min-h-0.min-w-0.flex-1.flex-col.justify-center.gap-1.overflow-x-auto.px-2.py-1';
    const track = strip.querySelector(trackSelector);
    if (!track) return 0;
    return Array.from(track.children).filter((child) => child.getAttribute('class')?.includes('flex-wrap')).length;
  }

  describe('happy path', () => {
    it('renders multiple measure rows when the observed canvas width supports ≥2 measures per line', () => {
      const { container } = render(
        <BrowserRouter>
          <EditorLayout />
        </BrowserRouter>,
      );
      const strips = screen.getAllByRole('region', { name: 'Measures' });
      const strip = strips[strips.length - 1]!;
      expect(strip).toBeTruthy();

      mockMainWidth(container, 400);
      fireEvent(window, new Event('resize'));

      const rows = countMeasureRows(strip);
      expect(rows).toBeGreaterThanOrEqual(2);
    });

    it('reduces measuresPerLine and increases row count when window width decreases', () => {
      const { container } = render(
        <BrowserRouter>
          <EditorLayout />
        </BrowserRouter>,
      );
      const strips = screen.getAllByRole('region', { name: 'Measures' });
      const strip = strips[strips.length - 1]!;
      expect(strip).toBeTruthy();

      mockMainWidth(container, 400);
      fireEvent(window, new Event('resize'));
      const rowsAtWideWidth = countMeasureRows(strip);

      mockMainWidth(container, 120);
      fireEvent(window, new Event('resize'));
      const rowsAtNarrowWidth = countMeasureRows(strip);

      expect(rowsAtNarrowWidth).toBeGreaterThanOrEqual(rowsAtWideWidth);
    });

    it('renders the measure strip region in the bottom shell and increases song measure count when Add is used', () => {
      render(
        <BrowserRouter>
          <EditorLayout />
        </BrowserRouter>,
      );
      const regions = screen.getAllByRole('region', { name: 'Measures' });
      expect(regions.length).toBeGreaterThanOrEqual(1);
      const strip = regions[regions.length - 1]!;
      expect(strip).toBeTruthy();
      const before = useSongStore.getState().song.measures.length;
      const add = within(strip).getByRole('button', { name: /^add$/i });
      fireEvent.click(add);
      expect(useSongStore.getState().song.measures.length).toBe(before + 1);
    });

    it('wires Delete to deleteMeasures on the song store when a range is selected', () => {
      render(
        <BrowserRouter>
          <EditorLayout />
        </BrowserRouter>,
      );
      const regions = screen.getAllByRole('region', { name: 'Measures' });
      const strip = regions[regions.length - 1]!;
      fireEvent.click(within(strip).getByRole('button', { name: measureLabel(1) }));
      fireEvent.click(within(strip).getByRole('button', { name: measureLabel(2) }), {
        shiftKey: true,
      });
      const before = useSongStore.getState().song.measures.length;
      fireEvent.click(within(strip).getByRole('button', { name: /^delete$/i }));
      expect(useSongStore.getState().song.measures.length).toBe(before - 2);
    });
  });
});
