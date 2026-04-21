/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-W5 / REF_AUDIT_1 RA-7 (shell + canvas props)
 *
 * Criterion — Top bar "Voice N" stays in sync with uiStore.activeVoice only:
 *   happy: changing active voice updates the single top-bar label; matches store
 *   edges: all four voices selectable; canvas data-melody-voice-visible shows four lanes when all visible
 *
 * ASSUMPTIONS: Toolbar badge remains the only "Voice {n}" phrase in the header chrome (properties
 * panel uses digit-only buttons per UX).
 */
import { EditorLayout } from '@/app/EditorLayout';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

function renderEditor(): void {
  render(
    <MemoryRouter initialEntries={['/editor']}>
      <Routes>
        <Route path="/editor" element={<EditorLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EditorLayout — UI-W5 — RA-7 top bar voice label', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.setState({
      activeVoice: 0,
      melodyVoiceVisible: [true, true, true, true] as const,
    });
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('shows exactly one header label "Voice {n}" that matches uiStore.activeVoice', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    const header = screen.getByRole('banner');
    expect(within(header).getAllByText(/^Voice [1-4]$/)).toHaveLength(1);
    expect(within(header).getByText(/^Voice 1$/)).toBeInTheDocument();

    await user.click(screen.getByTestId('properties-melody-active-voice-3'));

    await waitFor(() => {
      expect(useUIStore.getState().activeVoice).toBe(3);
    });

    expect(within(header).getAllByText(/^Voice [1-4]$/)).toHaveLength(1);
    expect(within(header).getByText(/^Voice 4$/)).toBeInTheDocument();
  });
});

describe('EditorLayout — UI-W5 — RA-8 chord palette shell wiring (library row)', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.setState({ activePanels: new Set<string>() });
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('renders the five-tab chord library strip inside the expanded chord palette panel', async () => {
    renderEditor();
    await screen.findByRole('application', { name: /Song editor/i });
    const tablist = screen.getByRole('tablist', { name: /Chord library/i });
    expect(tablist).toBeVisible();
    expect(within(tablist).getByRole('tab', { name: /^Progressions$/i })).toBeVisible();
  });
});

describe('EditorLayout — UI-R2-W7.4 — Progressions overlay behavior', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.setState({ activePanels: new Set<string>() });
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('opens the Progressions overlay when selecting the Progressions library tab', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    await user.click(screen.getByRole('tab', { name: /^Progressions$/i }));
    expect(screen.getByRole('dialog', { name: 'Progressions' })).toBeInTheDocument();
  });

  it('closes the Progressions overlay with Escape and restores focus to the trigger tab', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    const progressionsTab = screen.getByRole('tab', { name: /^Progressions$/i });
    await user.click(progressionsTab);
    expect(screen.getByRole('dialog', { name: 'Progressions' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Progressions' })).toBeNull();
    expect(progressionsTab).toHaveAttribute('aria-selected', 'true');
    expect(progressionsTab).toHaveFocus();
  });
});

describe('EditorLayout — UI-W5 — RA-7 canvas mirrors four melody lanes visibility', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.setState({
      activeVoice: 0,
      melodyVoiceVisible: [true, true, true, true] as const,
    });
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('sets data-melody-voice-visible="1111" on the editor canvas when all four melody lanes are visible', async () => {
    renderEditor();
    const canvas = await screen.findByRole('application', { name: /Song editor/i });
    await waitFor(() => {
      expect(canvas).toHaveAttribute('data-melody-voice-visible', '1111');
    });
  });
});
