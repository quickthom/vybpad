/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — OB-6 (operator backlog — UI density / windowed comfort)
 *
 * Same criteria as client/tests/e2e/ui-density.ob-6.spec.ts, but class/attribute contracts
 * (jsdom-safe) so `npm test` fails before implementation without Postgres. Playwright asserts
 * bounding boxes at 1280×768 when the E2E stack is available (docs/CI_LOCAL.md).
 *
 * Criterion — global density hook:
 *   happy: Editor shell root opts into compact base typography (`text-sm`).
 *
 * Criterion — transport chrome:
 *   happy: `vybpad-transport-toolbar` exposes `data-ui-density="compact"` (stable contract for
 *     density without coupling to a single Tailwind recipe).
 *
 * Criterion — side rail width caps:
 *   happy: Left chord palette rail and right inspector rail do not advertise a 400px max-width
 *     token; default rail width matches UX §3 (288px default, 240px minimum when resizable).
 */

import { EditorLayout } from '@/app/EditorLayout';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/store/authStore';
import { resetPlaybackStoreForTests } from '@/store/playbackStore';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';

const CHORD_PALETTE_MIN_WIDTH_PX = 240;
const CHORD_PALETTE_DEFAULT_WIDTH_PX = 240;
const CHORD_PALETTE_MAX_WIDTH_PX = 400;

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

function renderEditorShell(): void {
  render(
    <BrowserRouter>
      <EditorLayout />
    </BrowserRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetPlaybackStoreForTests();
});

beforeEach(() => {
  stubCanvas2d();
  resetPlaybackStoreForTests();
  useSongStore.getState().loadSong(buildDefaultSong());
  useUIStore.setState({
    activePanels: new Set<string>(),
  });
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'tester@example.com',
      displayName: 'QA Tester',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    accessToken: 'tok',
    isAuthenticated: true,
  });
});

describe('EditorLayout — OB-6 — shell density (text-sm)', () => {
  it('applies text-sm on the root editor shell wrapper for default type scale step-down', () => {
    renderEditorShell();

    const shell = document.querySelector('div.flex.min-h-screen.flex-col');
    expect(shell).toBeTruthy();
    const cls = shell?.getAttribute('class') ?? '';
    expect(cls.includes('text-sm'), 'OB-6: root shell should include text-sm').toBe(true);
  });
});

describe('EditorLayout — OB-6 — transport density attribute', () => {
  it('marks the transport toolbar with data-ui-density="compact"', () => {
    renderEditorShell();

    const toolbar = screen.getByTestId('vybpad-transport-toolbar');
    expect(toolbar).toHaveAttribute('data-ui-density', 'compact');
  });
});

describe('EditorLayout — OB-6 — side rail max-width caps (no legacy 400px token)', () => {
  it('does not use max-w-[400px] on the expanded chord palette rail', () => {
    renderEditorShell();

    const chordRail = document.querySelector('#vybpad-panel-chords');
    expect(chordRail).toBeTruthy();
    const cls = chordRail?.getAttribute('class') ?? '';
    expect(cls, 'OB-6: drop 400px cap in favor of a tighter windowed max-width').not.toMatch(
      /max-w-\[400px\]/,
    );
  });

  it('does not use max-w-[400px] on the right-hand inspector column', () => {
    renderEditorShell();

    const propsRoot = screen.getByTestId('properties-region');
    let el: HTMLElement | null = propsRoot;
    let found: HTMLElement | null = null;
    while (el) {
      const style = el.getAttribute('style') ?? '';
      if (/\bwidth:\s*\d+px/i.test(style)) {
        found = el;
        break;
      }
      el = el.parentElement;
    }
    expect(found, 'expected a width-controlled container around properties-region').toBeTruthy();
    expect(found?.getAttribute('style') ?? '', 'OB-6: right rail width should now be controlled by inline style').toMatch(
      /\bwidth:\s*\d+px/i,
    );
    expect(found?.getAttribute('class') ?? '', 'OB-6: right rail should not keep the loose 400px max-width token').not.toMatch(
      /max-w-\[400px\]/,
    );
  });
});

describe('EditorLayout — OB-6/RA-213 — chord rail default width and resize bounds', () => {
  it('uses 240px as the expanded left rail default width (inline style)', () => {
    renderEditorShell();

    const chordPanel = document.getElementById('vybpad-panel-chords');
    expect(chordPanel).toBeTruthy();
    expect(chordPanel?.style.width).toBe(`${CHORD_PALETTE_DEFAULT_WIDTH_PX}px`);
  });

  it('supports dragging the resize handle and clamps width to the UX min/max bounds', () => {
    renderEditorShell();

    const chordPanel = document.getElementById('vybpad-panel-chords');
    expect(chordPanel).toBeTruthy();
    const handle = screen.getByTestId('vybpad-panel-chords-resize-handle');

    fireEvent.mouseDown(handle, { button: 0, clientX: CHORD_PALETTE_DEFAULT_WIDTH_PX });
    fireEvent(window, new MouseEvent('mousemove', { bubbles: true, clientX: CHORD_PALETTE_MAX_WIDTH_PX + 250 }));
    fireEvent(window, new MouseEvent('mouseup', { bubbles: true, clientX: CHORD_PALETTE_MAX_WIDTH_PX + 250 }));
    expect(chordPanel?.style.width).toBe(`${CHORD_PALETTE_MAX_WIDTH_PX}px`);

    fireEvent.mouseDown(handle, { button: 0, clientX: CHORD_PALETTE_MAX_WIDTH_PX });
    fireEvent(window, new MouseEvent('mousemove', { bubbles: true, clientX: CHORD_PALETTE_MIN_WIDTH_PX - 250 }));
    fireEvent(window, new MouseEvent('mouseup', { bubbles: true, clientX: CHORD_PALETTE_MIN_WIDTH_PX - 250 }));
    const min = Number.parseFloat(chordPanel?.style.width ?? '0');
    expect(min).toBeGreaterThanOrEqual(CHORD_PALETTE_MIN_WIDTH_PX);
    expect(chordPanel?.style.width).toBe(`${CHORD_PALETTE_MIN_WIDTH_PX}px`);
  });
});
