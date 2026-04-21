/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-R2-W7.3
 *
 * Criterion 1 — Mixer must render as an overlay/modal, not as a permanently docked right-rail panel.
 *   happy: opening via toolbar injects a modal root with mixer title/roles while the right properties rail remains the
 *     properties rail only (mixer node is not a descendant of it).
 *   error: mixer appears as a static child of the right rail root with fixed-width rail displacement.
 *   edges: default `/editor` layout with default stores; verify with toolbar invocation from header only.
 *
 * Criterion 2 — Focus behavior for the overlay follows modal patterns.
 *   happy: focus is moved inside the modal when opened; Escape closes and returns focus to the toolbar trigger.
 *   error: focus remains outside on open or is lost on close.
 *   edges: use keyboard events (`{Escape}`) and default browser focus model in jsdom.
 *
 * Criterion 3 — Accessibility labeling and backdrop characteristics.
 *   happy: modal exposes dialog role, modal marking, accessible title linkage, and expected backdrop styling.
 *   error: non-labelled `aria`, non-`dialog` shell, no backdrop class/inline style.
 *
 * Criterion 4 — Existing mixer behavior and callback semantics are unchanged when opened as overlay.
 *   happy: volume edit updates song bandConfig and still calls engine setTrackVolume/setTrackMute.
 *   error: callback path no-ops or drops ready-engine updates.
 *   edges: overlay path via toolbar, then slider interaction.
 *
 * Criterion 5 — INTERFACES.md panel set semantics remain Set-based and toggle-driven.
 *   happy: `activePanels` stays a Set and `togglePanel("mixer")` is pure add/remove.
 *   error: panel set structure is not a Set or `togglePanel("mixer")` fails under repeated calls.
 */
import type { AudioEngine } from '@/engine/audio';
import * as audio from '@/engine/audio';
import { EditorLayout } from '@/app/EditorLayout';
import { useAuthStore } from '@/store/authStore';
import { resetPlaybackStoreForTests, usePlaybackStore } from '@/store/playbackStore';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
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

function createMockReadyEngine(
  opts: { setTrackVolume?: ReturnType<typeof vi.fn>; setTrackMute?: ReturnType<typeof vi.fn> } = {},
): AudioEngine {
  const setTrackVolume = opts.setTrackVolume ?? vi.fn();
  const setTrackMute = opts.setTrackMute ?? vi.fn();
  return {
    initialize: vi.fn(() => Promise.resolve()),
    isReady: () => true,
    loadSong: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seekTo: vi.fn(),
    setTempo: vi.fn(),
    setLoop: vi.fn(),
    setTrackVolume,
    setTrackMute,
    onTick: vi.fn(() => () => {}),
    dispose: vi.fn(),
  } as unknown as AudioEngine;
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
  usePlaybackStore.setState({ initStatus: 'ready', initErrorCode: null });
}

function renderEditorLayout(): void {
  render(
    <BrowserRouter>
      <EditorLayout />
    </BrowserRouter>,
  );
}

function parseStylePx(style: string | null, key: 'width' | 'min-width' | 'max-width'): number {
  if (!style) {
    return Number.NaN;
  }
  const regex = new RegExp(`${key}\\s*:\\s*(\\d+)px`, 'i');
  const match = style.match(regex);
  return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

function rightPropertiesPanel(): HTMLElement | null {
  return document.querySelector('section[role="region"][aria-label="Editor properties"]')?.closest('div') ?? null;
}

function getModalTabbables(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]',
    ),
  ).filter((el) => el.getAttribute('tabindex') !== '-1');
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

describe('UI-R2-W7.3 — criterion 1: mixer should be overlay/modal, not fixed rail child', () => {
  it('opens Mixer as a non-rail descendant modal and keeps the right rail at properties layout width', async () => {
    const user = userEvent.setup();

    renderEditorLayout();
    const rightPanel = rightPropertiesPanel();
    expect(parseStylePx(rightPanel?.getAttribute('style'), 'width')).toBe(192);

    const openMixer = screen.getByRole('button', { name: /^mixer$/i });
    await user.click(openMixer);

    const modal = screen.getByRole('dialog', { name: 'Mixer' });
    expect(modal).toBeTruthy();
    expect(rightPanel?.contains(modal)).toBe(false);
    expect(parseStylePx(rightPanel?.getAttribute('style'), 'width')).toBe(192);
  });
});

describe('UI-R2-W7.3 — criterion 2/3: mixer modal accessibility + focus behavior', () => {
  it('exposes modal semantics (role/labeling/backdrop) and restores focus to the toolbar button after Escape', async () => {
    const user = userEvent.setup();

    renderEditorLayout();
    const openMixer = screen.getByRole('button', { name: /^mixer$/i });
    openMixer.focus();
    await user.click(openMixer);

    const modal = screen.getByRole('dialog', { name: 'Mixer' });
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');

    const labelledBy = modal.getAttribute('aria-labelledby');
    const ariaLabel = modal.getAttribute('aria-label');
    expect(labelledBy || ariaLabel).not.toBeNull();
    if (labelledBy != null) {
      const title = document.getElementById(labelledBy);
      expect(title).toBeTruthy();
      expect(title!).toHaveTextContent(/^Mixer$/i);
    }

    const backdropClass =
      modal.className.includes('rgba(17,24,39,0.5)') ||
      modal.className.includes('backdrop:bg-[rgba(17,24,39,0.5)]') ||
      modal.className.includes('fixed') ||
      modal.className.includes('inset-0');
    expect(backdropClass).toBe(true);

    expect(modal.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Mixer' })).toBeNull();
    expect(openMixer).toHaveFocus();
  });

  it('keeps Tab focus inside modal and wraps from end-to-start / start-to-end', async () => {
    renderEditorLayout();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^mixer$/i }));
    const modal = screen.getByRole('dialog', { name: 'Mixer' });
    const focusables = getModalTabbables(modal);
    expect(focusables.length).toBeGreaterThan(1);

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: false, bubbles: true });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: true, bubbles: true });
    expect(document.activeElement).toBe(last);
  });
});

describe('UI-R2-W7.3 — criterion 4: unchanged callback behavior when opened as overlay', () => {
  it('still updates bandConfig and invokes ready-engine track mutators from mixer slider interaction', async () => {
    vi.spyOn(audio, 'getPlaybackEngine');
    const setTrackVolume = vi.fn();
    const setTrackMute = vi.fn();
    vi.mocked(audio.getPlaybackEngine).mockReturnValue(
      createMockReadyEngine({ setTrackVolume, setTrackMute }),
    );

    renderEditorLayout();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^mixer$/i }));
    fireEvent.change(screen.getByRole('slider', { name: /harmony volume/i }), { target: { value: '33' } });

    const harmony = useSongStore.getState().song.bandConfig.tracks.find((track) => track.role === 'harmony');
    expect(harmony).toBeTruthy();
    expect(harmony!.volume).toBeCloseTo(0.33, 5);
    expect(setTrackVolume).toHaveBeenCalledWith('harmony', harmony!.volume);
    expect(setTrackMute).toHaveBeenCalledWith('harmony', harmony!.mute);
  });
});

describe('UI-R2-W7.3 — criterion 5: interface contract for UIStore panel state', () => {
  it('keeps activePanels as a Set and toggles "mixer" id in/out via togglePanel', () => {
    useUIStore.setState({ activePanels: new Set<string>() });
    expect(useUIStore.getState().activePanels).toBeInstanceOf(Set);

    useUIStore.getState().togglePanel('mixer');
    expect(useUIStore.getState().activePanels).toBeInstanceOf(Set);
    expect(useUIStore.getState().activePanels.has('mixer')).toBe(true);

    useUIStore.getState().togglePanel('mixer');
    expect(useUIStore.getState().activePanels).toBeInstanceOf(Set);
    expect(useUIStore.getState().activePanels.has('mixer')).toBe(false);
  });
});
