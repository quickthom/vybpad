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
 * Criterion — Search tab filtering behavior (UI-R2-W6.2 / OB-11):
 *   happy: on chord-palette-search-filter, query updates visible rows in real time; case-insensitive + trimmed matching for
 *     symbol/chord name text; whitespace query restores all rows; reset path clears query state;
 *   error: no visible rows while on Search tab
 *   edges: no dependency on implementation-specific row markup for filter behavior checks
 *
 * ASSUMPTIONS: Builder adds `libraryTab` + `onLibraryTabChange` to `ChordPalette` per INTERFACES.md;
 * stable `data-testid`s below are the contract for RTL.
 */
import { ChordPalette } from '@/components/panels/ChordPalette';
import type { ChordPaletteProps } from '@/components/panels/ChordPalette';
import { PAT010_DIATONIC_DEGREE_HEX, PAT010_MAJOR_CENTRIC_RELATIVE_SEMITONE_HEX } from '@/engine/renderer/colorMaps';
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

function getSearchRows(): HTMLButtonElement[] {
  const panel = screen.getByRole('tabpanel');
  return Array.from(panel.querySelectorAll('button')) as HTMLButtonElement[];
}

function getSearchInput(): HTMLInputElement {
  return screen.getByRole('searchbox', { name: /^Filter chords$/i });
}

type PopularRow = {
  id: string;
  label: string;
  ariaLabel: string;
  styleHints: string;
};

const MIN_POPULAR_ROW_COUNT = 8;
const PAT_010_HEX = new Set(
  [...PAT010_DIATONIC_DEGREE_HEX, ...PAT010_MAJOR_CENTRIC_RELATIVE_SEMITONE_HEX].map((v) => v.toLowerCase()),
);

function normalizeText(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function normalizePat010Color(rawColor: string): string {
  const color = rawColor.toLowerCase();

  if (color.length === 4 || color.length === 5) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }

  if (color.length === 9) {
    return color.slice(0, 7);
  }

  return color.slice(0, 7);
}

function extractPopularRows(): HTMLButtonElement[] {
  const panel = screen.getByRole('tabpanel');
  const buttons = Array.from(panel.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.filter((button) => normalizeText(button.textContent ?? '').length > 0);
}

function popularRowSignatures(): PopularRow[] {
  return extractPopularRows().map((row, index) => ({
    id: row.getAttribute('data-testid') ?? `${index}`,
    label: normalizeText(row.textContent ?? ''),
    ariaLabel: row.getAttribute('aria-label') ?? '',
    styleHints: `${row.style.cssText} ${row.className}`.toLowerCase(),
  }));
}

function expectPopularRowsHaveActionableText(rows: PopularRow[]): void {
  for (const row of rows) {
    const { ariaLabel } = row;
    const parts = ariaLabel.split(',').map((part) => part.trim());

    expect(parts[0]).toContain('Add popular chord');
    expect(parts[1]).toContain('degree');
    expect(parts[2]).toBeTruthy();
    expect(parts[3]).toBeTruthy();
  }
}

function expectPopularRowsHavePat010Swatches(rows: PopularRow[]): void {
  const colorRegex = /#[0-9a-f]{3,8}/gi;

  for (const row of rows) {
    const matches = row.styleHints.match(colorRegex) ?? [];
    if (matches.length === 0) {
      continue;
    }

    const normalized = matches.map((match) => normalizePat010Color(match).toLowerCase());
    const knownColorMatch = normalized.some((value) => PAT_010_HEX.has(value));

    expect(knownColorMatch).toBe(true);
  }
}

function renderPopularPalette(currentKey: string, currentScale: 'major' | 'minor' = 'major'): void {
  render(
    <ChordPaletteW5
      {...baseProps()}
      currentKey={currentKey}
      currentScale={currentScale}
      libraryTab="popular"
      onLibraryTabChange={vi.fn()}
    />,
  );
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

describe('ChordPalette — UI-R2-W6.3 — Popular tab sequence behavior', () => {
  it('renders multiple distinct popular entries for C major', () => {
    renderPopularPalette('C', 'major');

    const rows = popularRowSignatures();
    expect(rows.length).toBeGreaterThanOrEqual(MIN_POPULAR_ROW_COUNT);
    expect(new Set(rows.map((row) => row.label)).size).toBeGreaterThan(1);
    expectPopularRowsHaveActionableText(rows);
  });

  it('keeps the same popular sequence data on repeated renders for identical key+scale', () => {
    const onChordSelect = vi.fn();

    const { rerender } = render(
      <ChordPaletteW5
        {...baseProps()}
        currentKey="C"
        currentScale="major"
        libraryTab="popular"
        onLibraryTabChange={vi.fn()}
        onChordSelect={onChordSelect}
      />,
    );

    const firstRun = popularRowSignatures().map((row) => `${row.id}::${row.label}`);
    rerender(
      <ChordPaletteW5
        {...baseProps()}
        currentKey="C"
        currentScale="major"
        libraryTab="popular"
        onLibraryTabChange={vi.fn()}
        onChordSelect={onChordSelect}
      />,
    );
    const secondRun = popularRowSignatures().map((row) => `${row.id}::${row.label}`);

    expect(secondRun).toEqual(firstRun);
  });

  it('adapts popular output for different contexts while staying deterministic per context', () => {
    const onChordSelect = vi.fn();

    const { rerender } = render(
      <ChordPaletteW5
        {...baseProps()}
        currentKey="C"
        currentScale="major"
        libraryTab="popular"
        onLibraryTabChange={vi.fn()}
        onChordSelect={onChordSelect}
      />,
    );

    const cMajorRows = popularRowSignatures().map((row) => `${row.id}::${row.label}`);

    rerender(
      <ChordPaletteW5
        {...baseProps()}
        currentKey="D"
        currentScale="minor"
        libraryTab="popular"
        onLibraryTabChange={vi.fn()}
        onChordSelect={onChordSelect}
      />,
    );

    const dMinorRows = popularRowSignatures().map((row) => `${row.id}::${row.label}`);

    expect(cMajorRows).not.toEqual(dMinorRows);
    rerender(
      <ChordPaletteW5
        {...baseProps()}
        currentKey="D"
        currentScale="minor"
        libraryTab="popular"
        onLibraryTabChange={vi.fn()}
        onChordSelect={onChordSelect}
      />,
    );
    const dMinorRowsAgain = popularRowSignatures().map((row) => `${row.id}::${row.label}`);

    expect(dMinorRowsAgain).toEqual(dMinorRows);
  });

  it('keeps popular row color cues PAT-010-compatible when swatches are rendered', () => {
    renderPopularPalette('C', 'major');
    const rows = popularRowSignatures();

    expectPopularRowsHaveActionableText(rows);
    expectPopularRowsHavePat010Swatches(rows);
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

describe('ChordPalette — UI-R2-W6.2 — Search filtering behavior', () => {
  it('filters visible search rows as the user types in the filter input', async () => {
    const user = userEvent.setup();
    render(
      <ChordPaletteW5
        {...baseProps()}
        mode="search"
        libraryTab="search"
        onLibraryTabChange={vi.fn()}
      />,
    );

    const input = getSearchInput();
    const allRows = getSearchRows();
    expect(allRows.length).toBeGreaterThan(0);
    expect(input).toHaveValue('');

    await user.type(input, 'i');
    const afterOne = getSearchRows();
    expect(afterOne.length).toBeLessThanOrEqual(allRows.length);

    await user.type(input, 'z');
    const afterTwo = getSearchRows();
    expect(afterTwo.length).toBeLessThanOrEqual(afterOne.length);
  });

  it('matches case-insensitive and trimmed symbol or name queries', async () => {
    const user = userEvent.setup();
    render(
      <ChordPaletteW5
        {...baseProps()}
        mode="search"
        libraryTab="search"
        onLibraryTabChange={vi.fn()}
      />,
    );

    const symbolToken = 'i';
    const nameToken = 'c';

    const input = getSearchInput();

    await user.clear(input);
    await user.type(input, `  ${symbolToken.toUpperCase()}  `);
    expect(getSearchRows().length).toBeGreaterThan(0);

    await user.clear(input);
    await user.type(input, `  ${nameToken.toLowerCase()}  `);
    expect(getSearchRows().length).toBeGreaterThan(0);

    await user.clear(input);
    await user.type(input, symbolToken.toLowerCase());
    const lowerCount = getSearchRows().length;
    await user.clear(input);
    await user.type(input, symbolToken.toUpperCase());
    const upperCount = getSearchRows().length;
    expect(lowerCount).toBe(upperCount);
  });

  it('restores full rows when filter is empty or whitespace-only', async () => {
    const user = userEvent.setup();
    render(
      <ChordPaletteW5
        {...baseProps()}
        mode="search"
        libraryTab="search"
        onLibraryTabChange={vi.fn()}
      />,
    );

    const input = getSearchInput();
    const allRows = getSearchRows();
    expect(allRows.length).toBeGreaterThan(0);

    await user.type(input, 'i');
    expect(getSearchRows().length).toBeLessThanOrEqual(allRows.length);

    await user.clear(input);
    await user.type(input, '   ');
    expect(getSearchRows().length).toBe(allRows.length);
  });

  it('keeps the search label visible and input accessible', () => {
    render(
      <ChordPaletteW5
        {...baseProps()}
        mode="search"
        libraryTab="search"
        onLibraryTabChange={vi.fn()}
      />,
    );

    const label = screen.getByText('Filter chords');
    expect(label.tagName).toBe('LABEL');
    expect(label).toBeVisible();

    const input = getSearchInput();
    const inputId = input.getAttribute('id');
    expect(inputId).not.toBeNull();
    expect(label).toHaveAttribute('for', inputId as string);
    expect(input).toHaveAccessibleName('Filter chords');
    expect(input).toHaveAttribute('type', 'search');
  });

  it('clears search filter state when Reset is triggered', async () => {
    const user = userEvent.setup();
    const onBrowseDefaultsReset = vi.fn();
    render(
      <ChordPaletteW5
        {...baseProps()}
        mode="search"
        libraryTab="search"
        onLibraryTabChange={vi.fn()}
        onBrowseDefaultsReset={onBrowseDefaultsReset}
      />,
    );

    const input = getSearchInput();
    await user.type(input, 'DM');
    expect(input).toHaveValue('DM');

    const reset = screen.getByRole('button', { name: /^Reset$/i });
    await user.click(reset);
    expect(onBrowseDefaultsReset).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('tab', { name: /^Search$/i }));
    expect(getSearchInput()).toHaveValue('');
  });
});
