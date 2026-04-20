/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-W7 / REF_AUDIT_1 RA-10, RA-12 (palette density + secondary controls)
 *
 * Criterion RA-10 — Diatonic/borrowed lists: dense single-column rows (Roman + chord name), PAT-010
 *   colors, not a dominant two-column large degree-tile grid with oversized numerals:
 *   happy: degree groups use single-column layout; each row shows Roman + absolute chord name;
 *     clicking a row still invokes onChordSelect with the expected diatonic/borrowed payload
 *   error: (layout contract only)
 *   edges: borrowed mode mirrors diatonic density rules when rows exist
 *
 * Criterion RA-12 — Cycle secondary / Clear to diatonic: not large primary CTAs in the left palette
 *   column; relocate to ChordProperties (right) and/or compact ghost controls; same edit path as `d`:
 *   happy: when a secondary chord is selected, controls appear only in properties OR as compact
 *     non-primary controls in the left rail (never both regions); never min-h-11 primary fill in left
 *   error: (n/a)
 *   edges: (single implementation path for relocation)
 *
 * Builder contract — stable hooks for RTL:
 * - Existing `data-testid`s: `chord-palette-degree-*`, `chord-palette-borrowed-degree-*`, `chord-palette-root`,
 *   `properties-region`, `#vybpad-panel-chords`
 * - Optional: `data-testid="properties-chord-secondary-cycle"` / `properties-chord-secondary-clear"` if buttons
 *   land in ChordProperties (recommended for deterministic queries)
 */
import { randomUUID } from 'node:crypto';

import { ChordPalette } from '@/components/panels/ChordPalette';
import { EditorLayout } from '@/app/EditorLayout';
import { pat010DiatonicHex } from '@/engine/renderer/colorMaps';
import { theoryEngine } from '@/engine/theory';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';
import type { ChordEvent, SongData } from '@vybpad/shared';
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

function baseChord(id: string, beat: number, duration: number): ChordEvent {
  return {
    id,
    scaleDegree: 1,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat,
    duration,
  };
}

function songWithChord(ch: ChordEvent): SongData {
  const song = buildDefaultSong();
  song.measures[0].chords.push(ch);
  return song;
}

describe('ChordPalette — UI-W7 — RA-10 diatonic/borrowed density (single column, Roman + chord name)', () => {
  it('does not use a two-column grid for the diatonic scale-degree list (dense single column)', () => {
    render(
      <ChordPalette currentKey="C" currentScale="major" mode="diatonic" onChordSelect={vi.fn()} />,
    );

    const group = screen.getByRole('group', { name: /Diatonic scale degrees/i });
    expect(group.className).not.toMatch(/grid-cols-2/);
  });

  it('renders the diatonic degree row as a horizontal block row for RA-207 (expected)', () => {
    render(<ChordPalette currentKey="C" currentScale="major" mode="diatonic" onChordSelect={vi.fn()} />);

    const group = screen.getByRole('group', { name: /Diatonic scale degrees/i });
    expect(group.className).toMatch(/\bflex-row\b/);
  });

  it('does not use a two-column grid for the borrowed chord list when borrowed chords are listed', async () => {
    const user = userEvent.setup();
    render(
      <ChordPalette currentKey="C" currentScale="major" mode="borrowed" onChordSelect={vi.fn()} />,
    );

    await user.selectOptions(screen.getByLabelText('Borrowed scale'), 'minor');

    const group = screen.queryByRole('group', { name: /Borrowed scale degrees/i });
    expect(group).not.toBeNull();
    expect(group!.className).not.toMatch(/grid-cols-2/);
  });

  it('shows Roman label and absolute chord name text on each diatonic degree row', () => {
    const key = 'C';
    const scale = 'major';

    render(<ChordPalette currentKey={key} currentScale={scale} mode="diatonic" onChordSelect={vi.fn()} />);

    for (let deg = 1; deg <= 7; deg += 1) {
      const preview: ChordEvent = {
        id: 'palette-preview',
        scaleDegree: deg as ChordEvent['scaleDegree'],
        quality: theoryEngine.getDiatonicQuality(deg, scale),
        seventh: theoryEngine.getDiatonicSeventh(deg, scale),
        suspension: 'none',
        addition: 'none',
        inversion: 0,
        borrowed: null,
        secondary: null,
        beat: 0,
        duration: 48,
      };
      const roman = theoryEngine.toRomanNumeral(preview, scale);
      const name = theoryEngine.toChordName(preview, key, scale);

      const row = screen.getByTestId(`chord-palette-degree-${deg}`);
      expect(row.textContent).toContain(roman);
      expect(row.textContent).toContain(name);
    }
  });

  it('renders diatonic degree rows with PAT-010 degree-coded color anchors for RA-207', () => {
    const key = 'C';
    const scale = 'major';

    render(<ChordPalette currentKey={key} currentScale={scale} mode="diatonic" onChordSelect={vi.fn()} />);

    for (let deg = 1; deg <= 7; deg += 1) {
      const row = screen.getByTestId(`chord-palette-degree-${deg}`);
      const expectedColor = pat010DiatonicHex(deg as ChordEvent['scaleDegree']).toLowerCase();
      const styleHints = `${row.getAttribute('style') ?? ''} ${row.className}`.toLowerCase();

      expect(styleHints).toContain(expectedColor);
    }
  });

  it('still applies a diatonic chord when the user activates a degree row', async () => {
    const user = userEvent.setup();
    const onChordSelect = vi.fn();

    render(<ChordPalette currentKey="C" currentScale="major" mode="diatonic" onChordSelect={onChordSelect} />);

    await user.click(screen.getByTestId('chord-palette-degree-4'));

    expect(onChordSelect).toHaveBeenCalledTimes(1);
    expect(onChordSelect.mock.calls[0]?.[0]).toMatchObject({
      scaleDegree: 4,
      borrowed: null,
      secondary: null,
    });
  });
});

describe('EditorLayout — UI-W7 — RA-12 secondary cycle/clear placement (properties or compact left)', () => {
  beforeEach(() => {
    stubCanvas2d();
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('does not expose Cycle secondary and Clear to diatonic as large primary controls in the left palette column without relocating or compact styling', async () => {
    const cid = randomUUID();
    const chord: ChordEvent = {
      ...baseChord(cid, 0, 48),
      scaleDegree: 5,
      quality: 'major',
      seventh: 'dom7',
      secondary: { function: 'V', target: 2 },
    };
    useSongStore.getState().loadSong(songWithChord(chord));
    useUIStore.getState().setSelection({ type: 'chord', measureIndex: 0, eventIds: [cid] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    const leftPanel = document.getElementById('vybpad-panel-chords');
    expect(leftPanel).not.toBeNull();

    const propsRegion = screen.getByTestId('properties-region');

    const cycleLeft = within(leftPanel!).queryByRole('button', { name: /^Cycle secondary \(d\)$/ });
    const clearLeft = within(leftPanel!).queryByRole('button', { name: /^Clear to diatonic$/ });
    const cycleRight =
      within(propsRegion).queryByTestId('properties-chord-secondary-cycle') ??
      within(propsRegion).queryByRole('button', { name: /Cycle secondary/ });
    const clearRight =
      within(propsRegion).queryByTestId('properties-chord-secondary-clear') ??
      within(propsRegion).queryByRole('button', { name: /Clear to diatonic/ });

    const relocatedToProperties =
      cycleRight != null &&
      clearRight != null &&
      cycleLeft == null &&
      clearLeft == null;

    const compactGhostInLeft =
      cycleLeft != null &&
      clearLeft != null &&
      cycleRight == null &&
      clearRight == null &&
      !/\bbg-\[var\(--color-primary/.test(cycleLeft.className) &&
      !/\bmin-h-11\b/.test(cycleLeft.className) &&
      !/\bmin-h-11\b/.test(clearLeft.className);

    expect(relocatedToProperties || compactGhostInLeft).toBe(true);
  });
});
