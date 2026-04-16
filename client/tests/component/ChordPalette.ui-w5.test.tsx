/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-W5 / REF_AUDIT_1 RA-8 (ChordPalette library row)
 *
 * Criterion — Five library tabs (INTERFACES `libraryTab` / `onLibraryTabChange`):
 *   happy: Magic, Popular, Search, Progressions, Bass Sets visible; tab change invokes callback;
 *     controlled `libraryTab` selects active tab
 *   error: (n/a for tab strip contract)
 *   edges: default tab when props omitted matches INTERFACES (parent defaults to "magic")
 *
 * Criterion — Progressions: two presets apply distinct degree sequences without console errors
 *   happy: two preset controls yield different chord degree fingerprints (store snapshot or handler)
 *   edges: console.error not called during preset apply
 *
 * Criterion — Other tabs: minimal functional content (stubs with interactivity per audit doc)
 *   happy: each non-progressions tab exposes at least one labeled interactive control
 *
 * ASSUMPTIONS: Builder adds `libraryTab` + `onLibraryTabChange` to `ChordPalette` per INTERFACES.md;
 * stable `data-testid`s below are the contract for RTL.
 */
import { ChordPalette } from '@/components/panels/ChordPalette';
import type { ChordPaletteProps } from '@/components/panels/ChordPalette';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type LibraryTab = 'magic' | 'popular' | 'search' | 'progressions' | 'bassSets';

type ChordPaletteW5Props = ChordPaletteProps & {
  libraryTab?: LibraryTab;
  onLibraryTabChange?: (tab: LibraryTab) => void;
};

const ChordPaletteW5 = ChordPalette as (props: ChordPaletteW5Props) => ReactElement;

function baseProps(): ChordPaletteProps {
  return {
    currentKey: 'C',
    currentScale: 'major',
    mode: 'diatonic',
    onChordSelect: vi.fn(),
  };
}

describe('ChordPalette — UI-W5 — RA-8 library tab strip (INTERFACES)', () => {
  it('renders five library tabs Magic, Popular, Search, Progressions, and Bass Sets', () => {
    const onLibraryTabChange = vi.fn();
    render(
      <ChordPaletteW5
        {...baseProps()}
        libraryTab="magic"
        onLibraryTabChange={onLibraryTabChange}
      />,
    );

    const tablist = screen.getByRole('tablist', { name: /Chord library/i });
    expect(tablist).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: /^Magic$/i })).toBeVisible();
    expect(screen.getByRole('tab', { name: /^Popular$/i })).toBeVisible();
    expect(screen.getByRole('tab', { name: /^Search$/i })).toBeVisible();
    expect(screen.getByRole('tab', { name: /^Progressions$/i })).toBeVisible();
    expect(screen.getByRole('tab', { name: /^Bass Sets$/i })).toBeVisible();
  });

  it('calls onLibraryTabChange with the selected tab when the user activates a different library tab', async () => {
    const user = userEvent.setup();
    const onLibraryTabChange = vi.fn();
    render(
      <ChordPaletteW5
        {...baseProps()}
        libraryTab="magic"
        onLibraryTabChange={onLibraryTabChange}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /^Progressions$/i }));

    expect(onLibraryTabChange).toHaveBeenCalledWith('progressions');
  });

  it('reflects controlled libraryTab so the active tab matches the libraryTab prop', () => {
    const { rerender } = render(
      <ChordPaletteW5
        {...baseProps()}
        libraryTab="popular"
        onLibraryTabChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: /^Popular$/i })).toHaveAttribute('aria-selected', 'true');

    rerender(
      <ChordPaletteW5
        {...baseProps()}
        libraryTab="bassSets"
        onLibraryTabChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: /^Bass Sets$/i })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('ChordPalette — UI-W5 — RA-8 Progressions presets', () => {
  it('applies two distinct preset degree sequences via onChordSelect without logging console errors', async () => {
    const user = userEvent.setup();
    const onChordSelect = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ChordPaletteW5
        {...baseProps()}
        onChordSelect={onChordSelect}
        libraryTab="progressions"
        onLibraryTabChange={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('chord-palette-progression-preset-a'));
    const seqA = onChordSelect.mock.calls.map((c) => c[0].scaleDegree);
    onChordSelect.mockClear();

    await user.click(screen.getByTestId('chord-palette-progression-preset-b'));
    const seqB = onChordSelect.mock.calls.map((c) => c[0].scaleDegree);

    expect(seqA.length).toBeGreaterThan(0);
    expect(seqB.length).toBeGreaterThan(0);
    expect(seqA.join(',')).not.toBe(seqB.join(','));
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});

describe('ChordPalette — UI-W5 — RA-8 discovery tab minimal content', () => {
  it.each([
    ['magic', 'chord-palette-magic-interactive'],
    ['popular', 'chord-palette-popular-interactive'],
    ['search', 'chord-palette-search-filter'],
    ['bassSets', 'chord-palette-bass-sets-interactive'],
  ] as const)('exposes an interactive control on the %s tab', async (tab, testId) => {
    const user = userEvent.setup();
    render(
      <ChordPaletteW5
        {...baseProps()}
        libraryTab={tab}
        onLibraryTabChange={vi.fn()}
      />,
    );

    const el = screen.getByTestId(testId);
    expect(el).toBeVisible();
    await user.click(el);
  });
});
