/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-4.8 (Loop bar UI)
 *
 * Criterion 4: LoopBar (or equivalent editor-shell controls) exists and is wired from EditorLayout.
 *   happy: the editor shell exposes a Loop group with accessible start/end tick inputs
 *   happy: applying a loop region from the shell updates PlaybackStore
 *
 * Criterion 1 cross-check: loop start/end inputs operate on integer ticks (PAT-004).
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorLayout } from '@/app/EditorLayout';
import { useAuthStore } from '@/store/authStore';
import { resetPlaybackStoreForTests, usePlaybackStore } from '@/store/playbackStore';
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

function renderEditorLayout(): ReturnType<typeof render> {
  return render(
    <BrowserRouter>
      <EditorLayout />
    </BrowserRouter>,
  );
}

function loopGroup(): HTMLElement {
  return screen.getByRole('group', { name: /loop/i });
}

function getLoopActionButton(group: HTMLElement): HTMLElement {
  const scope = within(group);
  const action =
    scope.queryByRole('button', { name: /set loop/i }) ??
    scope.queryByRole('button', { name: /enable loop/i }) ??
    scope.queryByRole('button', { name: /^loop$/i });

  if (!action) {
    throw new Error('Expected a loop action control in the editor shell.');
  }

  return action;
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

describe('EditorLayout — TASK-4.8 — loop bar shell wiring', () => {
  it('renders a Loop group with integer tick inputs for loop start and loop end', () => {
    renderEditorLayout();

    const group = loopGroup();
    const start = within(group).getByRole('spinbutton', { name: /loop start/i });
    const end = within(group).getByRole('spinbutton', { name: /loop end/i });

    expect(start).toHaveAttribute('type', 'number');
    expect(start).toHaveAttribute('step', '1');
    expect(end).toHaveAttribute('type', 'number');
    expect(end).toHaveAttribute('step', '1');
  });

  it('updates PlaybackStore when the user applies a loop region from the editor shell', async () => {
    const user = userEvent.setup();
    renderEditorLayout();

    const group = loopGroup();
    const start = within(group).getByRole('spinbutton', { name: /loop start/i });
    const end = within(group).getByRole('spinbutton', { name: /loop end/i });

    await user.clear(start);
    await user.type(start, '48');
    await user.clear(end);
    await user.type(end, '192');
    await user.click(getLoopActionButton(group));

    const state = usePlaybackStore.getState();
    expect(state.isLooping).toBe(true);
    expect(state.loopStart).toBe(48);
    expect(state.loopEnd).toBe(192);
  });
});
