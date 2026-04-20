/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-R2-W6.1
 *
 * Criterion 1 — No document-level vertical overflow dependency for shell chrome.
 *   happy: editor shell root is viewport-bounded (`min-h-screen flex flex-col`) and there is no inline `body`/`html`
 *     overflow style injection from this component.
 *   error: inline `overflow` styles on document roots or missing viewport wrapper would indicate layout escaping its host.
 *   edges: route path `/editor` with default song + default `UIStore` values (pre-viewport consolidation).
 *
 * Criterion 2 — Left and right rails have internal vertical overflow containers and remain viewport-bound.
 *   happy: left chord rail provides an internal `overflow-y-auto` container and the right rail contains
 *     the same internal vertical-scroll surface (`properties-region`) while the outer rail remains constrained.
 *   error: either rail is the only vertical scroll container or loses `min-h-0` in row/host classes.
 *   edges: right rail default contents (properties only) and left rail expanded by default.
 *
 * Criterion 3 — Center canvas host fills middle viewport band and scrolls on the intended axis.
 *   happy: canvas host (`main`) is a flex-1 middle-band element (`min-h-0`) with horizontal overflow support
 *     and without a vertical overflow contract on the host itself.
 *   error: missing `overflow-x-auto` or unintended vertical overflow utilities would couple canvas scrolling to page flow.
 *   edges: assertion uses DOM class contracts instead of raster metrics (robust in jsdom; Playwright provides metric follow-up).
 */

import { EditorLayout } from '@/app/EditorLayout';
import { resetPlaybackStoreForTests } from '@/store/playbackStore';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function renderEditorAtLocalEditor(): void {
  render(
    <MemoryRouter initialEntries={['/editor']}>
      <Routes>
        <Route path="/editor" element={<EditorLayout />} />
      </Routes>
    </MemoryRouter>,
  );
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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('UI-R2-W6.1 — criterion 1: shell should be viewport-bound and not document-scroll dependent', () => {
  it('renders the editor root as a full-height flex column shell with no inline document overflow override', () => {
    renderEditorAtLocalEditor();

    const shell = document.querySelector('div.flex.min-h-screen.flex-col');
    expect(shell).toBeTruthy();
    expect(shell?.className).toMatch(/\bflex\b/);
    expect(shell?.className).toMatch(/\bflex-col\b/);
    expect(shell?.className).toMatch(/\bmin-h-screen\b/);

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');

    const row = document.querySelector('div.flex.min-h-0.min-w-0.flex-1.flex-row');
    expect(row).toBeTruthy();
    expect(row?.className).toMatch(/\bmin-h-0\b/);
    expect(row?.className).toMatch(/\bflex-1\b/);
  });
});

describe('UI-R2-W6.1 — criterion 2: rail overflow must stay inside side rails', () => {
  it('keeps left and right scroll behavior in internal rail containers, not in the page root', () => {
    renderEditorAtLocalEditor();

    const leftRail = document.querySelector('aside#vybpad-panel-chords');
    expect(leftRail).toBeTruthy();
    const leftClass = leftRail?.getAttribute('class') ?? '';
    expect(leftClass).toMatch(/\bshrink-0\b/);
    expect(leftClass).toMatch(/\bmin-h-0\b/);
    expect(leftClass).toMatch(/\bmin-w-\[240px\]\b/);

    const leftScroller = leftRail?.querySelector('div.overflow-y-auto');
    expect(leftScroller).toBeTruthy();
    expect(leftScroller?.className).toMatch(/\boverflow-y-auto\b/);

    const rightRail = document.querySelector('section[role="region"][aria-label="Editor properties"]')?.closest('div');
    expect(rightRail).toBeTruthy();
    const rightRailClass = rightRail?.className ?? '';
    expect(rightRailClass).toMatch(/\bw-\[288px\]\b/);
    expect(rightRailClass).toMatch(/\bself-stretch\b/);
    expect(rightRailClass).toMatch(/\bmin-h-0\b/);

    const rightScroller = rightRail?.querySelector('section[role="region"][aria-label="Editor properties"]');
    expect(rightScroller).toBeTruthy();
    expect(rightScroller?.className).toMatch(/\boverflow-y-auto\b/);
  });
});

describe('UI-R2-W6.1 — criterion 3: middle canvas host should fill viewport and scroll horizontally only', () => {
  it('renders the canvas host as flex-fill with only horizontal overflow utility in the contract', () => {
    renderEditorAtLocalEditor();

    const mainHost = document.querySelector('main[aria-busy]');
    expect(mainHost).toBeTruthy();
    const cls = mainHost?.getAttribute('class') ?? '';
    expect(cls).toMatch(/\bflex-1\b/);
    expect(cls).toMatch(/\bmin-h-0\b/);
    expect(cls).toMatch(/\boverflow-x-auto\b/);

    expect(cls).not.toMatch(/\boverflow-y-auto\b/);
    expect(cls).not.toMatch(/\boverflow-y-scroll\b/);
    expect(cls).not.toMatch(/\boverflow-y-hidden\b/);
  });
});
