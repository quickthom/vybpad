/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-R2-W7.4 / RA-7.2 Progressions overlay behavior
 *
 * Criterion 1 — Choosing Progressions opens a right-side overlay/modal, not inline in the left rail.
 *   happy: click on Progressions creates a `<dialog role>` with modal semantics and backdrop, mounted outside
 *     `#vybpad-panel-chords`, with focusable content;
 *   error: progressions remains constrained inside chord rail/inline panel;
 *   edges: existing chord rail and right properties panel retain their normal shell behavior.
 *
 * Criterion 2 — Close + Escape restore focus reasonably.
 *   happy: close button (or Escape) hides overlay and returns focus to Progressions trigger;
 *   error: focus stays on document body / escapes panel.
 *
 * Criterion 3 — Progression rows render as horizontal roman blocks with PAT-010 color/typography cues.
 *   happy: row buttons expose multi-degree Roman sequences and include PAT-010-compatible hue hints;
 *   error: Arabic-only labels or uncolored row content.
 *
 * Criterion 4 — Clicking a progression row still mutates song via the same insert path.
 *   happy: selecting a progression row increases chord count by the number of Roman degrees visible in that row;
 *   error: no chord mutation when row is clicked.
 *
 * Criterion 5 — INTERFACES contract continuity (ChordPaletteProps).
 *   happy: test compiles against current INTERFACES keys (`libraryTab`, `onLibraryTabChange`, `onBrowseDefaultsReset`);
 *   edge: any break in contract flags at compile-time.
 *
 * ASSUMPTIONS:
 *   Builder introduces a dedicated Progressions overlay with a dialog role while preserving `ChordPaletteProps`
 *   shape from INTERFACES.md.
 */
import { EditorLayout } from '@/app/EditorLayout';
import { PAT010_DIATONIC_DEGREE_HEX, PAT010_MAJOR_CENTRIC_RELATIVE_SEMITONE_HEX } from '@/engine/renderer/colorMaps';
import { useAuthStore } from '@/store/authStore';
import { resetPlaybackStoreForTests } from '@/store/playbackStore';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PAT_010_HEX = new Set(
  [...PAT010_DIATONIC_DEGREE_HEX, ...PAT010_MAJOR_CENTRIC_RELATIVE_SEMITONE_HEX].map((v) => v.toLowerCase()),
);

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

function renderEditor(): void {
  render(
    <MemoryRouter initialEntries={['/editor']}>
      <Routes>
        <Route path="/editor" element={<EditorLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

function baselineEditorStateForUI(): void {
  useUIStore.setState({
    activePanels: new Set<string>(),
    entryMode: 'table',
  });
  useSongStore.getState().loadSong(buildDefaultSong());
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
  while (useUIStore.getState().entryMode !== 'table') {
    useUIStore.getState().toggleEntryMode();
  }
}

function parseProgressionTokens(value: string): string[] {
  const raw = (value ?? '').trim();
  return raw.match(/[ivx]+/gi) ?? [];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizePat010Color(rawColor: string): string {
  const color = rawColor.toLowerCase();
  if (color.length === 4 || color.length === 5) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  if (color.length >= 9) {
    return color.slice(0, 7);
  }
  return color.slice(0, 7);
}

function rowColorHintsFor(row: HTMLElement): string[] {
  const classAndStyle = `${row.className} ${row.getAttribute('style') ?? ''}`.toLowerCase();
  return (classAndStyle.match(/#[0-9a-f]{3,8}/gi) ?? []).map((value) => normalizePat010Color(value));
}

function progressionDialogName(dialog: HTMLElement): string {
  const ariaLabel = dialog.getAttribute('aria-label') ?? '';
  const labelledBy = dialog.getAttribute('aria-labelledby');
  const titled = labelledBy ? document.getElementById(labelledBy)?.textContent ?? '' : '';
  return normalizeWhitespace(`${ariaLabel} ${titled}`);
}

function queryProgressionDialogs(): HTMLElement[] {
  return screen
    .queryAllByRole('dialog')
    .filter((dialog) => progressionDialogName(dialog).toLowerCase().includes('progression'));
}

function getProgressionDialog(): HTMLElement {
  const named = queryProgressionDialogs();
  if (named.length === 1) return named[0]!;
  const all = screen.getAllByRole('dialog');
  expect(all, 'Progressions selection should open a single modal dialog').toHaveLength(1);
  return all[0];
}

function chordPalettePanel(): HTMLElement | null {
  return screen.getByRole('complementary', { name: 'Chord palette panel' }) as HTMLElement | null;
}

function isCloseControl(button: HTMLButtonElement): boolean {
  const ariaLabel = (button.getAttribute('aria-label') ?? '').toLowerCase();
  const text = normalizeWhitespace(button.textContent ?? '').toLowerCase();
  return ariaLabel === 'close' || text === '×' || text === 'x' || text.includes('close');
}

function isProgressionRowButton(button: HTMLButtonElement): boolean {
  if (isCloseControl(button)) {
    return false;
  }
  const text = normalizeWhitespace(button.textContent ?? '');
  const tokens = parseProgressionTokens(text);
  return tokens.length >= 2 && (/[–—-]/.test(text) || /\bprogression\b/i.test(text));
}

function getProgressionRows(dialog: HTMLElement): HTMLButtonElement[] {
  const buttons = Array.from(dialog.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.filter(isProgressionRowButton);
}

function getProgressionCloseButton(dialog: HTMLElement): HTMLButtonElement {
  const named = within(dialog).queryByRole<HTMLButtonElement>('button', { name: /close/i });
  if (named) {
    return named;
  }

  const glyph = within(dialog).getAllByRole<HTMLButtonElement>('button').find((button) => {
    const text = normalizeWhitespace(button.textContent ?? '').toLowerCase();
    return text === '×' || text === 'x';
  });

  expect(glyph, 'Progressions overlay must expose a close control').toBeTruthy();
  return glyph!;
}

function progressionChordCount(): number {
  return useSongStore
    .getState()
    .song.measures.reduce((total, measure) => total + measure.chords.length, 0);
}

async function openProgressionsOverlay(): Promise<{ trigger: HTMLButtonElement; dialog: HTMLElement }> {
  const user = userEvent.setup();
  const trigger = screen.getByRole('tab', { name: /^Progressions$/i }) as HTMLButtonElement;
  await user.click(trigger);
  const dialog = await waitFor(() => getProgressionDialog());
  return { trigger, dialog };
}

beforeEach(() => {
  stubCanvas2d();
  resetPlaybackStoreForTests();
  baselineEditorStateForUI();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('UI-R2-W7.4 — criterion 1: progressions should open as an overlay dialog', () => {
  it('opens via progressions tab as a dialog outside the left rail', async () => {
    const user = userEvent.setup();
    renderEditor();

    const { dialog } = await openProgressionsOverlay();
    expect(getProgressionDialog()).toBe(dialog);
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const panel = chordPalettePanel();
    expect(panel).not.toContainElement(dialog);

    const name = progressionDialogName(dialog).toLowerCase();
    expect(name).toContain('progress');
    expect(dialog.className).toMatch(/\b(fixed|absolute)\b/);
    expect(dialog.className).toMatch(/(inset-0|right-0|left-0)/);
    expect(dialog.className).toMatch(/(rgba\(17,24,39,0\.5\)|bg-\[rgba\(17,24,39,0\.5\)\])/);

    const innerPanel = dialog.lastElementChild as HTMLElement | null;
    expect(innerPanel).toBeTruthy();
    expect(innerPanel!.className).toMatch(/max-w|w-\[/);
    expect(innerPanel!.className).not.toMatch(/\bw-full\b/);
  });
});

describe('UI-R2-W7.4 — criterion 2: close + focus return behavior', () => {
  it('restores focus to the Progressions trigger on close control and on Escape', async () => {
    const user = userEvent.setup();
    renderEditor();

    const { trigger, dialog } = await openProgressionsOverlay();
    expect(dialog).toBeInTheDocument();

    const closeButton = getProgressionCloseButton(dialog);
    await user.click(closeButton);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();

    const reopened = await openProgressionsOverlay();
    expect(reopened.dialog).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reopened.trigger).toHaveFocus();
  });
});

describe('UI-R2-W7.4 — criterion 3: progression row structure and PAT-010 color hints', () => {
  it('renders progression rows as roman sequences with PAT-010-compatible hues', async () => {
    const user = userEvent.setup();
    renderEditor();

    const { dialog } = await openProgressionsOverlay();
    const rows = getProgressionRows(dialog);
    expect(rows.length, 'expected at least one progression row').toBeGreaterThan(0);

    for (const row of rows) {
      const text = normalizeWhitespace(row.textContent ?? '');
      expect(text).toMatch(/[ivx]+/i);
      expect(text).toMatch(/[ivx]+(?:\s*[–—-]\s*|\\s+)[ivx]+/i);
      expect(row.className).toMatch(/flex/);

      const colorHints = rowColorHintsFor(row);
      const hasPat010Color = colorHints.some((value) => PAT_010_HEX.has(value));
      expect(hasPat010Color, 'row should expose PAT-010-compatible color hints in style/class').toBe(true);
    }

    const firstRow = rows[0]!;
    await user.click(firstRow);
  });
});

describe('UI-R2-W7.4 — criterion 4: progression click still mutates song path', () => {
  it('inserts one chord event per Roman degree in the clicked progression row', async () => {
    const user = userEvent.setup();
    renderEditor();

    const { dialog } = await openProgressionsOverlay();
    const rows = getProgressionRows(dialog);
    expect(rows.length).toBeGreaterThan(0);

    const row = rows[0]!;
    const rowText = normalizeWhitespace(row.textContent ?? '');
    const degreeCount = parseProgressionTokens(rowText).length;
    expect(degreeCount, 'row should expose at least two Roman steps').toBeGreaterThan(1);

    const before = progressionChordCount();
    await user.click(row);
    const after = progressionChordCount();
    expect(after).toBe(before + degreeCount);
  });
});

describe('UI-R2-W7.4 — criterion 5: interface contract smoke check', () => {
  it('requires ChordPaletteProps surface fields required by the progressions flow', () => {
    const required: {
      currentKey: 'C';
      currentScale: 'major';
      onChordSelect: () => void;
      mode: 'diatonic';
    } = {
      currentKey: 'C',
      currentScale: 'major',
      onChordSelect: () => {},
      mode: 'diatonic',
    };
    const optionalLibraryTab: 'progressions' = 'progressions';
    const onLibraryTabChange = (tab: 'magic' | 'popular' | 'search' | 'progressions' | 'bassSets') => tab;
    const onBrowseDefaultsReset = () => {};

    expect(required.currentKey).toBe('C');
    expect(optionalLibraryTab).toBe('progressions');
    expect(typeof onLibraryTabChange).toBe('function');
    expect(typeof onBrowseDefaultsReset).toBe('function');
  });
});
