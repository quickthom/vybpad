/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-R2-W7.5a (RA-209 toolbar-shell consolidation)
 *
 * Criterion 1: Editor shell has one header row + one transport toolbar row after consolidation.
 *   happy: top-level shell row count is exactly 2 (`<header>` + `vybpad-transport-toolbar`).
 *   error: extra full-width transport-like rows exist (e.g. legacy standalone loop strip).
 *   edges: render `/editor` and `/editor/:projectId` with bootstrap project state.
 *
 * Criterion 2: Shared transport shell contract remains on `vybpad-transport-toolbar`.
 *   happy: play/pause/stop/rewind/current-beat/control clusters and key/meter readout are descendants.
 *   error: controls move outside toolbar or unstable IDs appear.
 *   edges: verify audio contract attributes (`data-audio-ready`, `aria-busy`) transition.
 *
 * Criterion 3: Key/meter/tempo/zoom defaults remain in the shared transport shell.
 *   happy: `key/meter` text, tempo 120, zoom 100% values are present in toolbar.
 *   error: values are changed or controls are removed from toolbar.
 *   edges: default song state (C major, 4/4, 120, zoom 100% / zoomY 100%).
 *
 * Criterion 4: Header-only actions are represented in the shared toolbar shell.
 *   happy: Save / Projects / Entry mode / Voice / Chords / Mixer / Settings / Piano / Key+scale / Log out.
 *   error: any action control lives only in the split header row.
 *   edges: `/editor/:projectId` with bootstrap state renders Save control.
 *
 * Criterion 5: Loop + export controls are in transport toolbar and no standalone loop row persists.
 *   happy: Loop start input and export cluster are descendants of toolbar; no direct root loop group sibling.
 *   error: loop remains as a separate row under editor shell.
 */

import type { ProjectResponse, SongData } from '@vybpad/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorLayout } from '@/app/EditorLayout';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { resetPlaybackStoreForTests, usePlaybackStore } from '@/store/playbackStore';
import { useUIStore } from '@/store/uiStore';

const BOOTSTRAP_PROJECT_ID = '00000000-0000-4000-8000-000000000001';

function projectPayloadForSong(song: SongData): ProjectResponse {
  const now = new Date().toISOString();
  return {
    id: BOOTSTRAP_PROJECT_ID,
    name: 'UI-R2-W7.5a QA',
    songData: song,
    createdAt: now,
    updatedAt: now,
  };
}

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

function renderEditorAtEditorRoute(opts?: { withProject: boolean }): void {
  if (opts?.withProject) {
    const song = buildDefaultSong();
    const project = projectPayloadForSong(song);
    render(
      <MemoryRouter
        initialEntries={[{ pathname: `/editor/${BOOTSTRAP_PROJECT_ID}`, state: { project } }]}
      >
        <Routes>
          <Route path="/editor/:projectId" element={<EditorLayout />} />
        </Routes>
      </MemoryRouter>,
    );
    return;
  }

  render(
    <MemoryRouter initialEntries={['/editor']}>
      <Routes>
        <Route path="/editor" element={<EditorLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

function transportToolbar(): HTMLElement {
  return screen.getByTestId('vybpad-transport-toolbar');
}

beforeEach(() => {
  stubCanvas2d();
  resetPlaybackStoreForTests();
  useSongStore.getState().loadSong(buildDefaultSong());
  useUIStore.setState({
    activePanels: new Set<string>(),
    entryMode: 'table',
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('UI-R2-W7.5a — toolbar shell consolidation baseline', () => {
  it('CR1 — editor shell keeps one top-level header row and one shared transport toolbar row', () => {
    renderEditorAtEditorRoute();
    const transport = transportToolbar();
    expect(transport).toHaveAttribute('role', 'toolbar');

    const shell = transport.closest('div.flex.min-h-screen.flex-col');
    expect(shell).toBeTruthy();

    const shellRows = Array.from(shell?.children ?? []).filter((node) => {
      const element = node as HTMLElement;
      return element.tagName.toLowerCase() === 'header' || element.getAttribute('data-testid') === 'vybpad-transport-toolbar';
    });

    expect(shellRows).toHaveLength(2);
  });

  it('CR2 — shared transport IDs and status contract stay on `vybpad-transport-toolbar`', () => {
    renderEditorAtEditorRoute();
    const toolbar = transportToolbar();

    const stableControls = [
      'vybpad-transport-undo',
      'vybpad-transport-redo',
      'vybpad-transport-play',
      'vybpad-transport-stop',
      'vybpad-transport-rewind',
      'vybpad-transport-current-beat',
      'vybpad-transport-key-meter-cluster',
      'vybpad-zoom-readout',
      'vybpad-zoom-y-readout',
      'vybpad-midi-export-cluster',
    ] as const;

    for (const id of stableControls) {
      const element = screen.getByTestId(id);
      expect(toolbar).toContainElement(element);
    }

    const tempoInput = screen.getByLabelText('Tempo');
    expect(toolbar).toContainElement(tempoInput);
    expect(toolbar).toHaveAttribute('data-audio-ready', 'false');
    expect(toolbar).not.toHaveAttribute('aria-busy', 'true');
  });

  it('CR3 — key/meter/tempo and zoom readouts are present in shared toolbar with default values', () => {
    renderEditorAtEditorRoute();
    const toolbar = transportToolbar();

    const keyMeter = toolbar.querySelector('[data-testid="vybpad-transport-key-meter-cluster"]');
    expect(keyMeter).toBeTruthy();
    expect(keyMeter?.textContent ?? '').toContain('4/4');
    expect(keyMeter?.textContent ?? '').toMatch(/\b(major|minor)\b/i);

    const tempoInput = screen.getByLabelText('Tempo') as HTMLInputElement;
    expect(tempoInput).toHaveValue('120');
    expect(toolbar).toContainElement(tempoInput);

    const zoomReadout = toolbar.querySelector('[data-testid="vybpad-zoom-readout"]');
    const zoomYReadout = toolbar.querySelector('[data-testid="vybpad-zoom-y-readout"]');
    expect(zoomReadout).toBeTruthy();
    expect(zoomYReadout).toBeTruthy();
    expect(zoomReadout?.textContent ?? '').toContain('100%');
    expect(zoomYReadout?.textContent ?? '').toContain('100%');
  });

  it('CR4 — header-only actions remain represented in shared toolbar shell and are reachable', () => {
    renderEditorAtEditorRoute({ withProject: true });
    const toolbar = transportToolbar();

    const expectedButtonActions = [
      { name: /^Save$/i, focusable: false },
      { name: /^Projects$/i, focusable: true },
      { name: /Entry mode/i, focusable: true },
      { name: /^Chords$/i, focusable: true },
      { name: /^Mixer$/i, focusable: true },
      { name: /^Settings$/i, focusable: true },
      { name: /^Piano$/i, focusable: true },
      { name: /Key \/ scale/i, focusable: true },
      { name: /log.?out/i, focusable: true },
    ] as const;

    for (const { name, focusable } of expectedButtonActions) {
      const actionControl = within(toolbar).getByRole('button', { name }) as HTMLElement;
      expect(toolbar).toContainElement(actionControl);
      expect(actionControl).toBeVisible();
      if (actionControl.getAttribute('disabled') == null && focusable) {
        actionControl.focus();
        expect(actionControl).toHaveFocus();
      } else {
        expect(actionControl).toBeDisabled();
      }
    }

    const voiceControl = within(toolbar).getByText(/^Voice\s+\d+/i);
    expect(toolbar).toContainElement(voiceControl);
    expect(voiceControl).toBeVisible();
    voiceControl.focus();
    expect(voiceControl).toHaveFocus();
  });

  it('CR5 — transport toolbar keeps audio-ready contract during init status transitions', () => {
    renderEditorAtEditorRoute();
    const toolbar = transportToolbar();

    usePlaybackStore.setState({ initStatus: 'initializing', initErrorCode: null });
    expect(toolbar).toHaveAttribute('aria-busy', 'true');
    expect(toolbar).toHaveAttribute('data-audio-ready', 'false');

    usePlaybackStore.setState({ initStatus: 'ready', initErrorCode: null });
    expect(toolbar).toHaveAttribute('data-audio-ready', 'true');
    expect(toolbar).not.toHaveAttribute('aria-busy', 'true');
  });

  it('CR6 — loop and export stay inside shared toolbar; no standalone loop row remains', () => {
    renderEditorAtEditorRoute();
    const toolbar = transportToolbar();

    const loopControls = screen.getAllByLabelText('Loop start');
    expect(loopControls).toHaveLength(1);
    expect(loopControls[0]).toBeVisible();
    expect(toolbar).toContainElement(loopControls[0]);

    const exportCluster = screen.getByTestId('vybpad-midi-export-cluster');
    expect(exportCluster).toBeVisible();
    expect(toolbar).toContainElement(exportCluster);

    const shell = toolbar.closest('div.flex.min-h-screen.flex-col');
    expect(shell).toBeTruthy();
    const standaloneLoopRows = Array.from(shell?.children ?? []).filter((child) => {
      const element = child as HTMLElement;
      return (
        element.getAttribute('role') === 'group' &&
        element.querySelector('[aria-label="Loop start"]') != null
      );
    });
    expect(standaloneLoopRows).toHaveLength(0);
  });
});

