/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-7.2
 *
 * Criterion 1: Primary h,j,k,l,;,` (and optional ') map to PAT-004/INTERFACES ticks; ShortcutCommandId
 *   setNoteDurationWhole … setNoteDurationThirtySecond.
 *   happy: each physical keydown resolves via ShortcutManager to the granular command id (editor scope).
 *   error: disabled thirty-second registration does not dispatch (product toggle).
 *   edges: alternate q,w,e,r,t map to same command ids as primary row keys (Hookpad alternate row).
 *
 * Criterion 4: Alternate row parity with primary tick ladder (sixteenth on `t`, not thirty-second).
 *
 * Contract: INTERFACES.md ShortcutManager, ShortcutDefinition, ShortcutCommandId; PAT-027 resolution.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  chordFromKeyboardEvent,
  createShortcutManager,
} from '@/engine/keyboard/shortcutManager';
import type { ShortcutCommandId, ShortcutContext, ShortcutDefinition } from '@/engine/keyboard/shortcutTypes';

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

/** Build registrations from live KeyboardEvents so chord strings match {@link chordFromKeyboardEvent}. */
function registerDurationCommands(
  mgr: ReturnType<typeof createShortcutManager>,
  rows: { init: Partial<KeyboardEventInit>; id: ShortcutCommandId; enabled?: boolean }[],
): void {
  for (const row of rows) {
    const ev = keydown(row.init);
    const chord = chordFromKeyboardEvent(ev);
    const def: ShortcutDefinition = {
      id: row.id,
      chord,
      scope: 'editor',
      conflictPolicy: 'replace',
      enabled: row.enabled,
    };
    mgr.registerShortcut(def);
  }
}

describe('TASK-7.2 — note duration shortcuts — ShortcutManager command ids (INTERFACES)', () => {
  const dispatch = vi.fn<(id: ShortcutCommandId) => void>();

  afterEach(() => {
    dispatch.mockClear();
  });

  it('dispatches setNoteDurationWhole through setNoteDurationSixteenth for primary row h j k l ;', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerDurationCommands(mgr, [
      { init: { key: 'h', code: 'KeyH' }, id: 'setNoteDurationWhole' },
      { init: { key: 'j', code: 'KeyJ' }, id: 'setNoteDurationHalf' },
      { init: { key: 'k', code: 'KeyK' }, id: 'setNoteDurationQuarter' },
      { init: { key: 'l', code: 'KeyL' }, id: 'setNoteDurationEighth' },
      { init: { key: ';', code: 'Semicolon' }, id: 'setNoteDurationSixteenth' },
    ]);

    const rows: { init: Partial<KeyboardEventInit>; id: ShortcutCommandId }[] = [
      { init: { key: 'h', code: 'KeyH' }, id: 'setNoteDurationWhole' },
      { init: { key: 'j', code: 'KeyJ' }, id: 'setNoteDurationHalf' },
      { init: { key: 'k', code: 'KeyK' }, id: 'setNoteDurationQuarter' },
      { init: { key: 'l', code: 'KeyL' }, id: 'setNoteDurationEighth' },
      { init: { key: ';', code: 'Semicolon' }, id: 'setNoteDurationSixteenth' },
    ];

    for (const { init, id } of rows) {
      dispatch.mockClear();
      const ev = keydown(init);
      expect(mgr.handleKeyDown(ev, baseContext())).toBe(true);
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith(id);
    }
  });

  it('dispatches setNoteDurationThirtySecond for ` (Backquote) when registered with enabled: true', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerDurationCommands(mgr, [{ init: { key: '`', code: 'Backquote' }, id: 'setNoteDurationThirtySecond', enabled: true }]);

    const ev = keydown({ key: '`', code: 'Backquote' });
    expect(mgr.handleKeyDown(ev, baseContext())).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('setNoteDurationThirtySecond');
  });

  it("dispatches setNoteDurationThirtySecond for ' (Quote) when the product enables that binding", () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerDurationCommands(mgr, [{ init: { key: "'", code: 'Quote' }, id: 'setNoteDurationThirtySecond', enabled: true }]);

    const ev = keydown({ key: "'", code: 'Quote' });
    expect(mgr.handleKeyDown(ev, baseContext())).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('setNoteDurationThirtySecond');
  });

  it('does not dispatch thirty-second when that binding is explicitly disabled', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerDurationCommands(mgr, [{ init: { key: "'", code: 'Quote' }, id: 'setNoteDurationThirtySecond', enabled: false }]);

    const ev = keydown({ key: "'", code: 'Quote' });
    expect(mgr.handleKeyDown(ev, baseContext())).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('maps alternate row q w e r t to the same command ids as h j k l ; (192…12 ladder)', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerDurationCommands(mgr, [
      { init: { key: 'q', code: 'KeyQ' }, id: 'setNoteDurationWhole' },
      { init: { key: 'w', code: 'KeyW' }, id: 'setNoteDurationHalf' },
      { init: { key: 'e', code: 'KeyE' }, id: 'setNoteDurationQuarter' },
      { init: { key: 'r', code: 'KeyR' }, id: 'setNoteDurationEighth' },
      { init: { key: 't', code: 'KeyT' }, id: 'setNoteDurationSixteenth' },
    ]);

    const rows: { init: Partial<KeyboardEventInit>; id: ShortcutCommandId }[] = [
      { init: { key: 'q', code: 'KeyQ' }, id: 'setNoteDurationWhole' },
      { init: { key: 'w', code: 'KeyW' }, id: 'setNoteDurationHalf' },
      { init: { key: 'e', code: 'KeyE' }, id: 'setNoteDurationQuarter' },
      { init: { key: 'r', code: 'KeyR' }, id: 'setNoteDurationEighth' },
      { init: { key: 't', code: 'KeyT' }, id: 'setNoteDurationSixteenth' },
    ];

    for (const { init, id } of rows) {
      dispatch.mockClear();
      expect(mgr.handleKeyDown(keydown(init), baseContext())).toBe(true);
      expect(dispatch).toHaveBeenCalledWith(id);
    }
  });

  it('does not dispatch editor duration shortcuts while ShortcutContext.hasModalOpen is true', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerDurationCommands(mgr, [{ init: { key: 'k', code: 'KeyK' }, id: 'setNoteDurationQuarter' }]);

    const ev = keydown({ key: 'k', code: 'KeyK' });
    expect(mgr.handleKeyDown(ev, baseContext({ hasModalOpen: true }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch editor-scoped duration shortcuts when ShortcutContext.hasEditorFocus is false', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    registerDurationCommands(mgr, [{ init: { key: 'k', code: 'KeyK' }, id: 'setNoteDurationQuarter' }]);

    const ev = keydown({ key: 'k', code: 'KeyK' });
    expect(mgr.handleKeyDown(ev, baseContext({ hasEditorFocus: false }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
