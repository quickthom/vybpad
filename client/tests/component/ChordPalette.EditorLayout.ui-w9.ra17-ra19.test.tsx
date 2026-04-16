/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-W9 / REF_AUDIT_1 RA-17, RA-19 (Wave 9 palette cleanup)
 *
 * Criterion RA-17 — No large empty "Applied chords" / ROMAN placeholder in left panel:
 *   happy: remove dead section OR show meaningful Roman/summary (not an empty em dash in a tall box)
 *   error: (n/a)
 *   edges: when chord is null, no min-height Roman stub (`min-h-[3rem]`) reserved for future content
 *
 * Criterion RA-19 — Section title + Reset:
 *   happy: primary palette heading matches intent "Chords in <key> <scale>" (e.g. C major)
 *   happy: Reset control inline with header; click restores palette browsing defaults:
 *     - diatonic mode tab selected
 *     - library tab back to default (Magic)
 *     - borrowed parallel source back to default for current home scale (C major → natural minor)
 *     - chord search filter cleared when Search tab exposes a filter field
 *   error: (n/a)
 *   edges: document expected defaults in assertions for Builder alignment
 */
import { ChordPalette, SecondaryChordInspector } from '@/components/panels/ChordPalette';
import { EditorLayout } from '@/app/EditorLayout';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

function renderEditorAtLocalEditor(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/editor']}>
      <Routes>
        <Route path="/editor" element={<EditorLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SecondaryChordInspector — UI-W9 — RA-17 empty Applied chords / Roman block', () => {
  it('does not reserve a large empty Roman placeholder box when no chord is selected', () => {
    const { container } = render(
      <SecondaryChordInspector chord={null} romanLabel="" onCycle={vi.fn()} onClear={vi.fn()} />,
    );

    // Current dead UI uses a min-h-[3rem] bordered Roman well with "—"; RA-17 removes or replaces with meaningful summary.
    const tallRomanWells = container.querySelectorAll('[class*="min-h-[3rem]"]');
    expect(tallRomanWells.length).toBe(0);
  });
});

describe('ChordPalette — UI-W9 — RA-19 section title', () => {
  it('uses a primary heading that reads as Chords in the current key and scale (e.g. C major)', () => {
    render(<ChordPalette currentKey="C" currentScale="major" mode="diatonic" onChordSelect={vi.fn()} />);

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /^Chords in C major$/i,
      }),
    ).toBeVisible();
  });
});

describe('EditorLayout — UI-W9 — RA-19 Reset restores palette browsing defaults', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('exposes Reset with the chord palette heading and returns diatonic mode, Magic tab, default borrowed source, and cleared search', async () => {
    const user = userEvent.setup();
    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    const leftPanel = document.getElementById('vybpad-panel-chords');
    expect(leftPanel).not.toBeNull();

    const paletteRegion = within(leftPanel!).getByRole('region', { name: /^Chord palette$/i });

    expect(within(paletteRegion).getByRole('heading', { level: 3, name: /^Chords in C major$/i })).toBeVisible();

    const reset = within(paletteRegion).getByRole('button', { name: /^Reset$/i });

    await user.click(within(leftPanel!).getByRole('button', { name: /^Borrowed$/i }));

    const borrowedSelect = within(leftPanel!).getByLabelText(/^Borrowed scale$/i);
    await user.selectOptions(borrowedSelect, 'dorian');

    await user.click(within(leftPanel!).getByRole('tab', { name: /^Search$/i }));
    const searchInput = within(leftPanel!).getByTestId('chord-palette-search-filter');
    await user.type(searchInput, 'vi');

    await user.click(reset);

    const diatonic = within(leftPanel!).getByRole('button', { name: /^Diatonic$/i });
    expect(diatonic).toHaveAttribute('aria-pressed', 'true');

    const magicTab = within(leftPanel!).getByRole('tab', { name: /^Magic$/i });
    expect(magicTab).toHaveAttribute('aria-selected', 'true');

    await user.click(within(leftPanel!).getByRole('button', { name: /^Borrowed$/i }));
    expect(within(leftPanel!).getByLabelText(/^Borrowed scale$/i)).toHaveValue('minor');

    await user.click(within(leftPanel!).getByRole('tab', { name: /^Search$/i }));
    expect(within(leftPanel!).getByTestId('chord-palette-search-filter')).toHaveValue('');

    expect(reset).toBeVisible();
  });
});
