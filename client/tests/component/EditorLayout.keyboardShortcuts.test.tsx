/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — Task 7.1 (focus gating + editor shell)
 *
 * Criterion 3 (UX §8 / INTERFACES ShortcutContext): Shortcuts must not steal editor actions from modals / text
 *   while still allowing grid behavior when the canvas is focused.
 *
 * happy: Tab toggles entry mode when focus is on the song editor canvas (not in a form control)
 * error: digit in a text input does not append chords (existing guard)
 * edges: modal open — global/editor shortcut dispatch must be suppressed (verified via ShortcutManager unit tests;
 *   this file asserts DOM-level focus: dialog open + query role dialog)
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorLayout } from '@/app/EditorLayout';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EditorLayout — Task 7.1 — keyboard shortcuts shell', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('toggles entry mode from Table to Text when Tab is fired with the song editor canvas focused', async () => {
    render(
      <BrowserRouter>
        <EditorLayout />
      </BrowserRouter>,
    );

    const canvas = await screen.findByRole('application', { name: /Song editor/i });
    (canvas as HTMLElement).focus();
    expect(document.activeElement).toBe(canvas);

    // Window capture listener (useKeyboard) — dispatch on window so jsdom invokes capture handlers like browsers.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(useUIStore.getState().entryMode).toBe('text');
    });

    const entryBtn = screen.getByRole('button', { name: /Entry mode Text/i });
    expect(entryBtn).toBeTruthy();
  });

  it('does not treat digit keys as chord entry when focus is in a text field (focus guard)', async () => {
    const edit = render(
      <BrowserRouter>
        <EditorLayout />
      </BrowserRouter>,
    );

    const tempo = screen.getByLabelText(/^tempo$/i);
    tempo.focus();

    const before = useSongStore.getState().song.measures[0]!.chords.length;
    fireEvent.keyDown(tempo, new KeyboardEvent('keydown', { key: '5', bubbles: true }));

    const after = useSongStore.getState().song.measures[0]!.chords.length;
    expect(after).toBe(before);

    edit.unmount();
  });

  it('exposes Key / scale as a modal dialog so shortcut suppression can key off modal state (Task 7.1 integration)', async () => {
    render(
      <BrowserRouter>
        <EditorLayout />
      </BrowserRouter>,
    );

    const keyScaleBtn = screen.getByRole('button', { name: /key \/ scale/i });
    fireEvent.click(keyScaleBtn);

    expect(await screen.findByRole('dialog', { name: /key and scale/i })).toBeTruthy();
  });
});
