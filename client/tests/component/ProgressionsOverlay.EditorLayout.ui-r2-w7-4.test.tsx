/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-R2-W7.4
 *
 * Criterion 1 — Progressions tab opens a floating right-anchored overlay, not a left-rail inline panel.
 *   happy: click "Progressions" opens one dialog and it lives as a fixed fullscreen shell anchored at right edge (`fixed inset-0 justify-end`);
 *     left chord rail (`#vybpad-panel-chords`) remains the normal left rail wrapper.
 *   error: dialog is rendered as a child of chord rail or panel root with rail-width behavior.
 *   edges: default editor entry mode; no external panel state toggles.
 *
 * Criterion 2 — Overlay has explicit close control and can close via close control / backdrop click / Escape.
 *   happy: close button exists (accessible label), click closes overlay, backdrop click closes overlay, Escape key closes overlay.
 *   error: close action is missing or does not complete state rollback.
 *   edges: opening overlay from default default song, default duration timing.
 *
 * Criterion 3 — Focus handling is reasonable (UX §5.6/§9) for overlay open and close.
 *   happy: focus moves into overlay on open, Tab focus is constrained when at edges, Escape restores focus to trigger.
 *   error: focus remains outside modal, no focus trap, or focus loss after close.
 *   edges: no active selection state changes.
 *
 * Criterion 4 — Progression rows render as horizontal Roman blocks with PAT-010 degree colors.
 *   happy: each preset button includes one block per degree, blocks arranged in a horizontal row, and each block carries the expected degree color.
 *   error: stacked/vertical or non-Roman presentation; PAT-010 mismatch.
 *   edges: default C major scale.
 *
 * Criterion 5 — Progression row click still uses existing `editChord` mutation path.
 *   happy: clicking preset A causes four `editChord` add actions (1,4,5,1) through store path.
 *   error: no store mutation call or missing/additional mutations through non-song-store callbacks.
 *   edges: no preexisting measure chords so insertion start is deterministic.
 *
 * Criterion 6 — Open/close overlay repeatedly without destabilizing adjacent panel behavior.
 *   happy: repeated open + close cycles leave chord rail width and properties rail visibility stable.
 *   error: repeated open/close leaks panel state or deforms existing layout.
 *   edges: two close mechanisms used across cycles (close button, Escape, backdrop).
 */

import { EditorLayout } from '@/app/EditorLayout';
import { pat010DiatonicHex } from '@/engine/renderer/colorMaps';
import { useAuthStore } from '@/store/authStore';
import { resetPlaybackStoreForTests, usePlaybackStore } from '@/store/playbackStore';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';
import type { ChordEvent, ScaleDegree } from '@vybpad/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DegreeMap = {
  a: readonly ScaleDegree[];
  b: readonly ScaleDegree[];
};

const PRESET_DEGREES: DegreeMap = {
  a: [1, 4, 5, 1],
  b: [2, 5, 1, 6],
};

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

function previewCall(degree: ScaleDegree, index: number): { type: 'add'; chord: Partial<ChordEvent> } {
  return {
    type: 'add',
    chord: {
      scaleDegree: degree,
      beat: index * 48,
      duration: 48,
      quality: expect.any(String),
      seventh: expect.any(String),
      suspension: expect.any(String),
      addition: expect.any(String),
      inversion: expect.any(Number),
      borrowed: null,
      secondary: null,
    },
  } as { type: 'add'; chord: Partial<ChordEvent> };
}

function renderEditorAtEditorRoute(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/editor']}>
      <Routes>
        <Route path="/editor" element={<EditorLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

function parsePxFromStyle(style: string | null): number {
  const match = style?.match(/(\d+)px/i);
  return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

function chordPalettePanelWidthPx(): number {
  return parsePxFromStyle(document.getElementById('vybpad-panel-chords')?.style.width ?? null);
}

function propertiesRegionExists(): void {
  expect(screen.getByTestId('properties-region')).toBeTruthy();
}

function getTabbables(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]',
    ),
  ).filter((el) => el.getAttribute('tabindex') !== '-1');
}

async function openProgressionsPanel(user: ReturnType<typeof userEvent['setup']>): Promise<HTMLElement> {
  const tab = screen.getByRole('tab', { name: /^Progressions$/i });
  await user.click(tab);
  const overlay = await screen.findByRole('dialog', { name: /^Progressions$/i });
  return overlay;
}

function getProgressionPresetButton(presetId: keyof DegreeMap): HTMLElement {
  return screen.getByTestId(`chord-palette-progression-preset-${presetId}`);
}

function progressionBlockSpans(presetButton: HTMLElement): HTMLSpanElement[] {
  const spans = Array.from(presetButton.querySelectorAll('span'));
  const blockRow = spans.find((element): element is HTMLSpanElement => element.className.includes('mb-2') || element.className.includes('mb-1.5'));
  expect(blockRow).not.toBeNull();
  return Array.from(blockRow.children).filter((node): node is HTMLSpanElement => node instanceof HTMLSpanElement);
}

function expectProgressionRowHasRowLayoutAndColors(presetButton: HTMLElement, degrees: readonly ScaleDegree[]): void {
  const spans = Array.from(presetButton.querySelectorAll('span'));
  const blockRow = spans.find((element): element is HTMLSpanElement => element.className.includes('mb-2') || element.className.includes('mb-1.5'));
  expect(blockRow).not.toBeNull();
  expect(blockRow!.className).toMatch(/\bflex\b/);
  expect(blockRow!.className).not.toMatch(/\bflex-col\b/);

  const blocks = progressionBlockSpans(presetButton);
  expect(blocks).toHaveLength(degrees.length);

  for (const [index, degree] of degrees.entries()) {
    const block = blocks[index];
    expect(block.textContent).not.toBe('');
    expect((block!.getAttribute('style') ?? '').toLowerCase()).toContain(pat010DiatonicHex(degree).toLowerCase());
    expect(block!.className).toMatch(/rounded-(md|lg)/);
    expect(block!.className).toMatch(/min-w-\[2\.25rem\]|min-w-12/);
  }
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
  usePlaybackStore.setState({ initStatus: 'ready', initErrorCode: null });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('UI-R2-W7.4 — criterion 1: progressions as right anchored overlay', () => {
  it('opens Progressions as a fixed right-anchored dialog instead of a left inline panel child', async () => {
    const user = userEvent.setup();

    renderEditorAtEditorRoute();
    const leftPanel = document.getElementById('vybpad-panel-chords');
    expect(leftPanel).not.toBeNull();

    const overlay = await openProgressionsPanel(user);
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay).toHaveAttribute('aria-modal', 'true');
    expect(overlay.className).toContain('fixed');
    expect(overlay.className).toContain('inset-0');
    expect(overlay.className).toContain('justify-end');
    expect(leftPanel?.contains(overlay)).toBe(false);
  });
});

describe('UI-R2-W7.4 — criterion 2: overlay close control + close mechanisms', () => {
  it('renders close control and closes via click, backdrop click, and Escape', async () => {
    const user = userEvent.setup();

    renderEditorAtEditorRoute();
    await openProgressionsPanel(user);

    const closeButton = screen.getByRole('button', { name: /^Close progressions panel$/i });
    await user.click(closeButton);
    expect(screen.queryByRole('dialog', { name: /^Progressions$/i })).toBeNull();

    const overlay = await openProgressionsPanel(user);
    fireEvent.click(overlay);
    expect(screen.queryByRole('dialog', { name: /^Progressions$/i })).toBeNull();

    await openProgressionsPanel(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /^Progressions$/i })).toBeNull();
  });
});

describe('UI-R2-W7.4 — criterion 3: focus behavior', () => {
  it('moves focus into overlay, keeps Tab focus inside, and returns focus to the trigger on Escape', async () => {
    const user = userEvent.setup();
    renderEditorAtEditorRoute();

    const trigger = screen.getByRole('tab', { name: /^Progressions$/i });
    trigger.focus();
    const overlay = await openProgressionsPanel(user);
    expect(overlay.contains(document.activeElement)).toBe(true);

    const tabbables = getTabbables(overlay);
    expect(tabbables.length).toBeGreaterThan(1);

    const last = tabbables[tabbables.length - 1];
    const first = tabbables[0];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', bubbles: true });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: true, bubbles: true });
    expect(document.activeElement).toBe(last);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /^Progressions$/i })).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe('UI-R2-W7.4 — criterion 4: progression rows and PAT-010 colorized blocks', () => {
  it('renders each preset as a horizontal roman block sequence with degree-based swatches in PAT-010', async () => {
    renderEditorAtEditorRoute();
    await openProgressionsPanel(userEvent.setup());

    expectProgressionRowHasRowLayoutAndColors(
      getProgressionPresetButton('a'),
      PRESET_DEGREES.a,
    );
    expectProgressionRowHasRowLayoutAndColors(
      getProgressionPresetButton('b'),
      PRESET_DEGREES.b,
    );
  });
});

describe('UI-R2-W7.4 — criterion 5: progression mutation path', () => {
  it('routes progression row application through useSongStore.editChord add actions (1,4,5,1)', async () => {
    const user = userEvent.setup();
    const editChord = vi.spyOn(useSongStore.getState(), 'editChord');

    renderEditorAtEditorRoute();
    const beforeCount = useSongStore.getState().song.measures[0]!.chords.length;

    await openProgressionsPanel(user);
    await user.click(getProgressionPresetButton('a'));

    expect(editChord).toHaveBeenCalledTimes(4);
    const progressionPayloads = editChord.mock.calls.map((entry) => entry[1]);
    const degrees = progressionPayloads.map((entry) => entry.chord.scaleDegree);
    expect(degrees).toEqual(PRESET_DEGREES.a);
    expect(progressionPayloads).toEqual(PRESET_DEGREES.a.map((degree, index) => expect.objectContaining(previewCall(degree, index))));

    const afterCount = useSongStore.getState().song.measures[0]!.chords.length;
    expect(afterCount).toBe(beforeCount + 4);
  });
});

describe('UI-R2-W7.4 — criterion 6: stable repeated open/close', () => {
  it('opens and closes the overlay repeatedly without changing existing panel size/state', async () => {
    const user = userEvent.setup();
    renderEditorAtEditorRoute();

    const baselineWidth = chordPalettePanelWidthPx();
    expect(Number.isNaN(baselineWidth)).toBe(false);
    propertiesRegionExists();

    await openProgressionsPanel(user);
    const closeButton = screen.getByRole('button', { name: /^Close progressions panel$/i });
    await user.click(closeButton);
    expect(screen.queryByRole('dialog', { name: /^Progressions$/i })).toBeNull();

    const magicTab = screen.getByRole('tab', { name: /^Magic$/i });
    const progressionsTab = screen.getByRole('tab', { name: /^Progressions$/i });

    await user.click(magicTab);
    await user.click(progressionsTab);
    const overlay = await screen.findByRole('dialog', { name: /^Progressions$/i });
    fireEvent.click(overlay);
    expect(screen.queryByRole('dialog', { name: /^Progressions$/i })).toBeNull();

    expect(chordPalettePanelWidthPx()).toBe(baselineWidth);
    propertiesRegionExists();
  });
});

