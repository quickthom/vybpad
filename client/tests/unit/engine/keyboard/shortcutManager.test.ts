/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — Task 7.1
 *
 * Criterion 1: Registry resolves normalized chords per INTERFACES.md `ShortcutManager`.
 *   happy: register `ShortcutDefinition`, `handleKeyDown` matches `KeyboardEvent` → returns consumed + `onCommand(id)`
 *   error: N/A
 *   edges: normalization stable; empty chord segments
 *
 * Criterion 2: PAT-027 conflict policy (scope precedence, replace vs first-wins).
 *   happy: narrower scope beats wider; `replace` swaps same-scope duplicate chord; `ignore`/`warn` keep first
 *   error: blocked context must not call `onCommand`
 *   edges: duplicate id re-register; unregister
 *
 * Criterion 3: `ShortcutContext` gating — modal open or text editing suppresses shortcuts (fail closed).
 *   happy: when allowed context, command fires
 *   error: `hasModalOpen` / `isTextEditing` → no dispatch (unless explicitly exempt — none in this suite)
 *   edges: `hasEditorFocus` false rejects editor-scoped chords
 *
 * Criterion 4: Edge — noop / blocked → return false, no spurious dispatch (PAT-027).
 *
 * ASSUMPTIONS:
 * - Factory accepts `{ onCommand }` as the public wiring surface (not spelled in INTERFACES.md); `ShortcutManager` remains the runtime contract.
 * - `warn` matches PAT-027 with `ignore` for resolution (first registration wins); dev-only logging is untested here.
 * - Stub `createShortcutManager` leaves `handleKeyDown` unimplemented → positive-path tests fail until Builder lands dispatch.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createShortcutManager,
  normalizeChord,
  tokenFromKeyboardEventKey,
  type CreateShortcutManagerOptions,
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

describe('shortcut manager — Task 7.1 — chord normalization', () => {
  it('normalizes modifier letter casing and order to canonical Ctrl+Shift+T style', () => {
    expect(normalizeChord('ctrl+shift+t')).toBe('Ctrl+Shift+T');
    expect(normalizeChord('shift+ctrl+t')).toBe('Ctrl+Shift+T');
    expect(normalizeChord('  Ctrl  +  Shift  +  t  ')).toBe('Ctrl+Shift+T');
  });

  it('treats Space as a single key token', () => {
    expect(normalizeChord('Ctrl+Space')).toBe('Ctrl+Space');
    expect(normalizeChord('ctrl+space')).toBe('Ctrl+Space');
  });
});

describe('shortcut manager — Task 7.1 — tokenFromKeyboardEventKey', () => {
  it('maps digit keys consistently with chord registration strings', () => {
    expect(tokenFromKeyboardEventKey('3', 'Digit3')).toBe('3');
  });
});

describe('shortcut manager — Task 7.1 — register + resolve (contract)', () => {
  const dispatch = vi.fn<(id: ShortcutCommandId) => void>();

  afterEach(() => {
    dispatch.mockClear();
  });

  it('returns true from handleKeyDown and invokes onCommand with the registered id when the chord matches (Builder implementation)', () => {
    const opts: CreateShortcutManagerOptions = { onCommand: dispatch };
    const mgr = createShortcutManager(opts);
    mgr.registerShortcut({
      id: 'zoomIn',
      chord: 'Ctrl+Equals',
      scope: 'editor',
      conflictPolicy: 'replace',
    });

    const ev = keydown({ key: '=', code: 'Equal', ctrlKey: true });
    const consumed = mgr.handleKeyDown(ev, baseContext());
    expect(consumed).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('zoomIn');
  });

  it('prefers a higher-specificity scope over global for the same normalized chord (PAT-027)', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    mgr.registerShortcut({
      id: 'rewindPlayback',
      chord: 'Ctrl+R',
      scope: 'global',
      conflictPolicy: 'replace',
    });
    mgr.registerShortcut({
      id: 'zoomIn',
      chord: 'Ctrl+R',
      scope: 'editor',
      conflictPolicy: 'replace',
    });
    const ev = keydown({ key: 'r', code: 'KeyR', ctrlKey: true });
    const consumed = mgr.handleKeyDown(ev, baseContext({ hasEditorFocus: true }));
    expect(consumed).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('zoomIn');
  });

  it('with conflictPolicy replace, a second binding for the same scope+chord wins dispatch', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    mgr.registerShortcut({
      id: 'zoomOut',
      chord: 'Ctrl+Y',
      scope: 'editor',
      conflictPolicy: 'replace',
    });
    mgr.registerShortcut({
      id: 'zoomIn',
      chord: 'Ctrl+Y',
      scope: 'editor',
      conflictPolicy: 'replace',
    });
    const ev = keydown({ key: 'y', code: 'KeyY', ctrlKey: true });
    expect(mgr.handleKeyDown(ev, baseContext())).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('zoomIn');
  });

  it('with conflictPolicy ignore, the first registration wins and the second does not override', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    mgr.registerShortcut({
      id: 'zoomOut',
      chord: 'Ctrl+Y',
      scope: 'editor',
      conflictPolicy: 'ignore',
    });
    mgr.registerShortcut({
      id: 'zoomIn',
      chord: 'ctrl+y',
      scope: 'editor',
      conflictPolicy: 'replace',
    });
    const ev = keydown({ key: 'y', code: 'KeyY', ctrlKey: true });
    expect(mgr.handleKeyDown(ev, baseContext())).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('zoomOut');
  });

  it('does not dispatch editor-scoped shortcuts when hasEditorFocus is false (fail closed)', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    mgr.registerShortcut({
      id: 'moveSelectionLeft',
      chord: 'ArrowLeft',
      scope: 'editor',
    });
    const ev = keydown({ key: 'ArrowLeft', code: 'ArrowLeft' });
    expect(mgr.handleKeyDown(ev, baseContext({ hasEditorFocus: false }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('suppresses dispatch while a modal is open', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    mgr.registerShortcut({ id: 'playPause', chord: 'Space', scope: 'global' });
    const ev = keydown({ key: ' ', code: 'Space' });
    expect(mgr.handleKeyDown(ev, baseContext({ hasModalOpen: true }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('suppresses dispatch while isTextEditing is true', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    mgr.registerShortcut({ id: 'toggleEntryMode', chord: 'Tab', scope: 'global' });
    const ev = keydown({ key: 'Tab', code: 'Tab' });
    expect(mgr.handleKeyDown(ev, baseContext({ isTextEditing: true }))).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns false and does not call onCommand when no binding matches (fail closed)', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    mgr.registerShortcut({ id: 'zoomIn', chord: 'Ctrl+BracketLeft', scope: 'editor' });
    const ev = keydown({ key: 'x', code: 'KeyX' });
    expect(mgr.handleKeyDown(ev, baseContext())).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('unregisterShortcut removes a command so it no longer dispatches', () => {
    const mgr = createShortcutManager({ onCommand: dispatch });
    mgr.registerShortcut({ id: 'zoomIn', chord: 'Ctrl+9', scope: 'global' });
    mgr.unregisterShortcut('zoomIn');
    const ev = keydown({ key: '9', code: 'Digit9', ctrlKey: true });
    expect(mgr.handleKeyDown(ev, baseContext())).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('shortcut manager — Task 7.1 — ShortcutDefinition shape', () => {
  it('accepts disabled shortcut definitions without throwing at registration time', () => {
    const mgr = createShortcutManager({ onCommand: vi.fn() });
    const def: ShortcutDefinition = {
      id: 'resetZoom',
      chord: 'Ctrl+0',
      scope: 'editor',
      enabled: false,
    };
    expect(() => mgr.registerShortcut(def)).not.toThrow();
  });
});
