/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-W7.4 / RA-7.2 Progressions overlay behavior
 */
import { EditorLayout } from '@/app/EditorLayout';
import { PAT010_DIATONIC_DEGREE_HEX, PAT010_MAJOR_CENTRIC_RELATIVE_SEMITONE_HEX } from '@/engine/renderer/colorMaps';
import { useAuthStore } from '@/store/authStore';
import { resetPlaybackStoreForTests } from '@/store/playbackStore';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';
import { cleanup, render, screen, within } from '@testing-library/react';
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

function extractColorHints(textOrStyle: string): string[] {
  return (textOrStyle.match(/#[0-9a-f]{3,8}/gi) ?? []).map((value) => normalizePat010Color(value));
}

function rowHasPat010Color(row: HTMLElement): boolean {
  const source = [
    row.getAttribute('style') ?? '',
    row.className,
    ...Array.from(row.querySelectorAll('span')).map(
      (step) => `${step.getAttribute('style') ?? ''} ${step.className}`,
    ),
  ].join(' ');
  const colors = extractColorHints(source);
  return colors.some((color) => PAT_010_HEX.has(color));
}

function chordCount(): number {
  return useSongStore.getState().song.measures.reduce((count, measure) => count + measure.chords.length, 0);
}

function romanBlockCount(row: HTMLElement): number {
  return row.querySelectorAll('span[style*="linear-gradient(90deg"]').length;
}

function baselineEditorState(): void {
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
  useSongStore.getState().loadSong(buildDefaultSong());
  useUIStore.setState({
    activePanels: new Set<string>(),
    entryMode: 'table',
    selection: { type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 },
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

async function openProgressionsOverlay(user: ReturnType<typeof userEvent.setup>): Promise<{
  trigger: HTMLButtonElement;
  dialog: HTMLElement;
}> {
  const trigger = screen.getByRole('tab', { name: /^Progressions$/i }) as HTMLButtonElement;
  await user.click(trigger);

  const dialog = await screen.findByRole('dialog');
  return { trigger, dialog };
}

beforeEach(() => {
  vi.restoreAllMocks();
  stubCanvas2d();
  resetPlaybackStoreForTests();
  baselineEditorState();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('UI-W7.4 — progressions rows render in a right-side dialog overlay', () => {
  it('opens the progressions list from the Progressions tab outside the chord palette panel', async () => {
    const user = userEvent.setup();
    renderEditor();

    const { dialog } = await openProgressionsOverlay(user);
    const panel = screen.getByRole('complementary', { name: 'Chord palette panel' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(panel).not.toContainElement(dialog);
  });
});

describe('UI-W7.4 — progressions close behavior', () => {
  it('closes with close control and Escape, returning focus to the Progressions tab', async () => {
    const user = userEvent.setup();
    renderEditor();

    const { trigger, dialog } = await openProgressionsOverlay(user);
    const closeButton = within(dialog).getByRole('button', { name: /close/i });

    await user.click(closeButton);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();

    const reopened = await openProgressionsOverlay(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reopened.trigger).toHaveFocus();
  });

  it('also closes when clicking the backdrop', async () => {
    const user = userEvent.setup();
    renderEditor();

    const { dialog } = await openProgressionsOverlay(user);
    await user.click(dialog);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('UI-W7.4 — progressions apply path', () => {
  it('renders roman blocks with PAT-010 hues and applies one chord per degree on click', async () => {
    const user = userEvent.setup();
    renderEditor();

    const { dialog } = await openProgressionsOverlay(user);
    const row = within(dialog).getByTestId('chord-palette-progression-preset-a');
    const blockCount = romanBlockCount(row);
    const degreeCount = (row.textContent ?? '').match(/[ivx]+/gi)?.length ?? 0;

    expect(blockCount).toBe(4);
    expect(rowHasPat010Color(row)).toBe(true);
    expect(degreeCount).toBe(4);

    const before = chordCount();
    await user.click(row);
    await expect
      .poll(() => chordCount(), { timeout: 1000 })
      .toBe(before + degreeCount);
  });
});
