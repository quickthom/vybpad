/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-7.3
 *
 * Criterion 1 (registry): `/` → splitSelection, `t` → tieSelection, Shift+T → toggleTriplet (PAT-027).
 * Criterion 2 (context): same gating as TASK-7.2 — modal open, text editing, no editor (canvas) focus block editor shortcuts.
 *
 * Product rules (behavioral tests live in useKeyboard.task-7-3 file):
 * - Split: selected single melody note with duration > 1 tick and evenly split per grid; two resulting notes same pitch.
 * - Tie: valid pair of adjacent same-pitch notes in the active voice (selection rules) merged into one duration.
 * - Triplet toggle: maps standard durations to PAT-004 triplet tick equivalents (e.g. eighth 24 ↔ triplet eighth 16).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShortcutManager } from '@/engine/keyboard/shortcutManager';
import type { ShortcutCommandId, ShortcutContext, ShortcutDefinition } from '@/engine/keyboard/shortcutTypes';
import { TASK73_EDITOR_SHORTCUT_CHORDS } from '@/engine/keyboard/task73ShortcutChords';

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

function registerSplitTieTriplet(
  mgr: ReturnType<typeof createShortcutManager>,
  rows: { init: Partial<KeyboardEventInit>; id: keyof typeof TASK73_EDITOR_SHORTCUT_CHORDS }[],
): void {
  for (const row of rows) {
    const chord = TASK73_EDITOR_SHORTCUT_CHORDS[row.id];
    const def: ShortcutDefinition = {
      id: row.id,
      chord,
      scope: 'editor',
      conflictPolicy: 'replace',
    };
    mgr.registerShortcut(def);
  }
}

describe('TASK-7.3 — split / tie / triplet — ShortcutManager command ids (INTERFACES)', () => {
  const dispatch = vi.fn<(id: ShortcutCommandId) => void>();

  afterEach(() => {
    dispatch.mockClear();
  });

  it('dispatches splitSelection for / (Slash)', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerSplitTieTriplet(mgr, [{ init: { key: '/', code: 'Slash' }, id: 'splitSelection' }]);

    const ev = keydown({ key: '/', code: 'Slash' });
    expect(mgr.handleKeyDown(ev, baseContext())).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('splitSelection');
  });

  it('dispatches tieSelection for t (KeyT)', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerSplitTieTriplet(mgr, [{ init: { key: 't', code: 'KeyT' }, id: 'tieSelection' }]);

    const ev = keydown({ key: 't', code: 'KeyT' });
    expect(mgr.handleKeyDown(ev, baseContext())).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('tieSelection');
  });

  it('dispatches toggleTriplet for Shift+T', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerSplitTieTriplet(mgr, [{ init: { key: 'T', code: 'KeyT', shiftKey: true }, id: 'toggleTriplet' }]);

    const ev = keydown({ key: 'T', code: 'KeyT', shiftKey: true });
    expect(mgr.handleKeyDown(ev, baseContext())).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('toggleTriplet');
  });

  it('does not dispatch editor split/tie/triplet while ShortcutContext.hasModalOpen is true', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerSplitTieTriplet(mgr, [
      { init: { key: '/', code: 'Slash' }, id: 'splitSelection' },
      { init: { key: 't', code: 'KeyT' }, id: 'tieSelection' },
      { init: { key: 'T', code: 'KeyT', shiftKey: true }, id: 'toggleTriplet' },
    ]);

    expect(mgr.handleKeyDown(keydown({ key: '/', code: 'Slash' }), baseContext({ hasModalOpen: true }))).toBe(false);
    expect(mgr.handleKeyDown(keydown({ key: 't', code: 'KeyT' }), baseContext({ hasModalOpen: true }))).toBe(false);
    expect(mgr.handleKeyDown(keydown({ key: 'T', code: 'KeyT', shiftKey: true }), baseContext({ hasModalOpen: true }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch when ShortcutContext.hasEditorFocus is false (no canvas / editor focus)', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerSplitTieTriplet(mgr, [{ init: { key: '/', code: 'Slash' }, id: 'splitSelection' }]);

    const ev = keydown({ key: '/', code: 'Slash' });
    expect(mgr.handleKeyDown(ev, baseContext({ hasEditorFocus: false }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch editor shortcuts while ShortcutContext.isTextEditing is true', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerSplitTieTriplet(mgr, [{ init: { key: 't', code: 'KeyT' }, id: 'tieSelection' }]);

    const ev = keydown({ key: 't', code: 'KeyT' });
    expect(mgr.handleKeyDown(ev, baseContext({ isTextEditing: true }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
