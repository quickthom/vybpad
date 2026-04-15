/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — TASK-7.8 (UI polish — UX_GUIDELINES touch targets, settings heading, dev strings)
 *
 * Criterion — P0/P1: toolbar controls meet minimum touch dimensions (44×44px) in header + LoopBar.
 *   happy: header chrome buttons use Tailwind min-h-11 (44px); compact Loop actions use min-h-11 + min-w-11.
 *   error: n/a
 *   edges: class-token contract (avoids brittle pixel CSS in jsdom where Tailwind is not fully resolved).
 *
 * Criterion — Editor settings panel heading level for nested aside (Designer): title is h3 not h2.
 *   happy: accessible "Editor settings" heading is DOM level 3.
 *
 * Criterion — Remove internal "(TASK-…)" user-facing copy from EditorLayout.
 *   happy: shell text does not contain "(TASK-" (comments in source are not in DOM).
 */

import { EditorSettingsPanel } from '@/components/panels/EditorSettingsPanel';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorLayout } from '@/app/EditorLayout';
import { useAuthStore } from '@/store/authStore';
import { resetPlaybackStoreForTests } from '@/store/playbackStore';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';

/** Tailwind `min-h-11` / arbitrary 44px — UX minimum touch height. */
const MIN_H_TOUCH = /\bmin-h-11\b|\bmin-h-\[44px\]/;
/** Tailwind `min-w-11` / arbitrary 44px — paired with height for compact icon-like controls. */
const MIN_W_TOUCH = /\bmin-w-11\b|\bmin-w-\[44px\]/;

function expectMinHeightTouchClass(el: HTMLElement, hint?: string): void {
  const c = typeof el.className === 'string' ? el.className : '';
  expect(c, hint ?? el.textContent?.trim()).toMatch(MIN_H_TOUCH);
}

function expectCompact44BoxClasses(el: HTMLElement, hint?: string): void {
  const c = typeof el.className === 'string' ? el.className : '';
  expect(c, hint ?? el.textContent?.trim()).toMatch(MIN_H_TOUCH);
  expect(c, hint ?? el.textContent?.trim()).toMatch(MIN_W_TOUCH);
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

function renderEditorShell(): void {
  render(
    <BrowserRouter>
      <EditorLayout />
    </BrowserRouter>,
  );
}

function defaultEditorSettingsProps(
  overrides: Partial<ComponentProps<typeof EditorSettingsPanel>> = {},
): ComponentProps<typeof EditorSettingsPanel> {
  return {
    entryMode: 'table',
    labelMode: 'degree',
    colorScheme: 'diatonic',
    showGuides: false,
    staffSpacing: 'default',
    onEntryModeChange: vi.fn(),
    onLabelModeChange: vi.fn(),
    onColorSchemeChange: vi.fn(),
    onShowGuidesChange: vi.fn(),
    onStaffSpacingChange: vi.fn(),
    ...overrides,
  };
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

describe('EditorSettingsPanel — TASK-7.8 — settings title heading level (nested panel)', () => {
  it('uses heading level 3 for the "Editor settings" title (document outline inside editor shell)', () => {
    render(<EditorSettingsPanel {...defaultEditorSettingsProps()} />);

    const heading = screen.getByRole('heading', { name: /editor settings/i });
    expect(heading.tagName.toLowerCase()).toBe('h3');
  });
});

describe('EditorLayout — TASK-7.8 — no internal TASK id string in user-visible copy', () => {
  it('does not expose "(TASK-…)" in the editor shell text content', () => {
    const { container } = render(
      <BrowserRouter>
        <EditorLayout />
      </BrowserRouter>,
    );

    expect(container.textContent ?? '').not.toMatch(/\(TASK-/i);
  });
});

describe('EditorLayout — TASK-7.8 — header cluster touch targets (min-h-11 / 44px)', () => {
  it('uses min-h-11 (or min-h-[44px]) on primary chrome buttons (Projects, panels, Key/scale, log out)', () => {
    renderEditorShell();

    const projects = screen.getByRole('button', { name: /^projects$/i });
    const chords = screen.getByRole('button', { name: /^chords$/i });
    const mixer = screen.getByRole('button', { name: /^mixer$/i });
    const settings = screen.getByRole('button', { name: /^settings$/i });
    const piano = screen.getByRole('button', { name: /^piano$/i });
    const keyScale = screen.getByRole('button', { name: /key.*scale/i });
    const logOut = screen.getByRole('button', { name: /log out/i });

    for (const el of [projects, chords, mixer, settings, piano, keyScale, logOut]) {
      expectMinHeightTouchClass(el);
    }
  });
});

describe('EditorLayout — TASK-7.8 — LoopBar action buttons touch targets (44px box)', () => {
  it('uses min-h-11 and min-w-11 (or 44px arbitrary) on Set loop and Clear loop buttons', () => {
    renderEditorShell();

    const group = screen.getByRole('group', { name: /loop/i });
    const setLoop = within(group).getByRole('button', { name: /set loop/i });
    const clearLoop = within(group).getByRole('button', { name: /clear loop/i });

    expectCompact44BoxClasses(setLoop);
    expectCompact44BoxClasses(clearLoop);
  });
});
