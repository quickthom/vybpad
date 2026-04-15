/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-7.5
 *
 * Criterion: PAT-027 — ShortcutManager resolves TASK-7.5 navigation + transport chords; editor vs global scope;
 *   context gating (modal, text editing, editor focus) per INTERFACES ShortcutContext.
 *   happy: Ctrl+Equals → zoomIn; ArrowUp → scrollUp; Space → playPause (global)
 *   error: —
 *   edges: no editor zoom without canvas focus; modal blocks transport; text editing blocks editor scroll
 *
 * Chord strings match INTERFACES.md normalized form and the TASK-7.5 registration table (Builder parity).
 */

import { describe, expect, it, vi } from 'vitest';

import { createShortcutManager } from '@/engine/keyboard/shortcutManager';
import type { ShortcutCommandId, ShortcutContext } from '@/engine/keyboard/shortcutTypes';

/** Canonical registrations for TASK-7.5 (see Builder `task75NavigationShortcutChords` when present). */
const TASK75_NAVIGATION_SHORTCUT_CHORDS = {
  zoomInPrimary: 'Ctrl+Equals',
  scrollUp: 'ArrowUp',
} as const;

const TASK75_TRANSPORT_SHORTCUT_CHORDS = {
  playPause: 'Space',
} as const;

function keydown(
  init: Partial<KeyboardEventInit & { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }>,
): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

function baseContext(over: Partial<ShortcutContext> = {}): ShortcutContext {
  return {
    hasModalOpen: false,
    isTextEditing: false,
    hasEditorFocus: true,
    isPlaying: false,
    ...over,
  };
}

/** Mirrors EditorLayout TASK-7.5 registration set (subset exercised here). */
function registerTask75Navigation(mgr: ReturnType<typeof createShortcutManager>): void {
  mgr.registerShortcut({
    id: 'zoomIn',
    chord: TASK75_NAVIGATION_SHORTCUT_CHORDS.zoomInPrimary,
    scope: 'editor',
    conflictPolicy: 'replace',
  });
  mgr.registerShortcut({
    id: 'scrollUp',
    chord: TASK75_NAVIGATION_SHORTCUT_CHORDS.scrollUp,
    scope: 'editor',
    conflictPolicy: 'replace',
  });
  mgr.registerShortcut({
    id: 'playPause',
    chord: TASK75_TRANSPORT_SHORTCUT_CHORDS.playPause,
    scope: 'global',
    conflictPolicy: 'replace',
  });
}

describe('TASK-7.5 — navigation shortcut registry (PAT-027)', () => {
  it('dispatches zoomIn for Ctrl+Equals when editor context allows', () => {
    const dispatch = vi.fn<(id: ShortcutCommandId) => void>();
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerTask75Navigation(mgr);
    const ev = keydown({ key: '=', code: 'Equal', ctrlKey: true });
    expect(mgr.handleKeyDown(ev, baseContext({ hasEditorFocus: true }))).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('zoomIn');
  });

  it('does not dispatch editor zoom when hasEditorFocus is false', () => {
    const dispatch = vi.fn<(id: ShortcutCommandId) => void>();
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerTask75Navigation(mgr);
    const ev = keydown({ key: '=', code: 'Equal', ctrlKey: true });
    expect(mgr.handleKeyDown(ev, baseContext({ hasEditorFocus: false }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches playPause for Space with global scope even without canvas focus', () => {
    const dispatch = vi.fn<(id: ShortcutCommandId) => void>();
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerTask75Navigation(mgr);
    const ev = keydown({ key: ' ', code: 'Space' });
    expect(mgr.handleKeyDown(ev, baseContext({ hasEditorFocus: false }))).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('playPause');
  });

  it('blocks global transport when a modal is open', () => {
    const dispatch = vi.fn<(id: ShortcutCommandId) => void>();
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerTask75Navigation(mgr);
    const ev = keydown({ key: ' ', code: 'Space' });
    expect(mgr.handleKeyDown(ev, baseContext({ hasModalOpen: true, hasEditorFocus: true }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('blocks editor scroll when text editing (fail closed)', () => {
    const dispatch = vi.fn<(id: ShortcutCommandId) => void>();
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerTask75Navigation(mgr);
    const ev = keydown({ key: 'ArrowUp', code: 'ArrowUp' });
    expect(mgr.handleKeyDown(ev, baseContext({ isTextEditing: true, hasEditorFocus: true }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('blocks global transport when text editing', () => {
    const dispatch = vi.fn<(id: ShortcutCommandId) => void>();
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerTask75Navigation(mgr);
    const ev = keydown({ key: ' ', code: 'Space' });
    expect(mgr.handleKeyDown(ev, baseContext({ isTextEditing: true }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
