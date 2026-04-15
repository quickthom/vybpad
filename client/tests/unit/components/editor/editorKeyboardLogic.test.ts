/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — Task 7.1 (Phase 2 regression via shared shortcut layer)
 *
 * Criterion: Duration keys, digit entry, Tab entry-mode toggle, and Ctrl+digit voice switching
 *   continue to work when editor key events flow through the shortcut manager facade (PAT-027).
 *
 * Contract surface: `handleEditorKeydown` + `EditorKeyboardContext` (useKeyboard.ts), and
 * `DURATION_KEYS` / table caret rules from editorKeyboardLogic.ts.
 *
 * happy: `k` → 48 ticks; digit `5` → chord add with collapsed range; Tab → toggle; Ctrl+2 → voice 1
 * error: text mode without duration armed ignores digit (existing rule)
 * edges: triplet duration keys `q`..`t` aliases match DURATION_KEYS
 */

import type { EditorKeyboardContext } from '@/hooks/useKeyboard';
import { DURATION_KEY_TICKS, handleEditorKeydown } from '@/hooks/useKeyboard';
import { DURATION_KEYS } from '@/components/editor/editorKeyboardLogic';
import { buildDefaultSong } from '@/store/songStore';
import { describe, expect, it, vi } from 'vitest';

function makeCtx(overrides: Partial<EditorKeyboardContext> = {}): EditorKeyboardContext {
  const song = buildDefaultSong();
  const rangeCaret = { type: 'range' as const, measureIndex: 0, rangeStart: 0, rangeEnd: 0 };
  return {
    song,
    viewport: { startMeasure: 0, measureCount: 8, scrollY: 0, zoom: 1 },
    selection: rangeCaret,
    activeVoice: 0,
    setActiveVoice: vi.fn(),
    entryMode: 'table',
    currentDurationTicks: 48,
    setCurrentDurationTicks: vi.fn(),
    keyboardTargetMeasureRef: { current: null },
    textDurationArmedRef: { current: false },
    getSongAfterMutation: () => song,
    getSelectionAfterMutation: () => rangeCaret,
    onChordEdit: vi.fn(),
    onNoteEdit: vi.fn(),
    onSelectionChange: vi.fn(),
    ...overrides,
  };
}

describe('editor keyboard — Task 7.1 — duration keys (Phase 2 / PAT-004)', () => {
  it('maps primary duration row h j k l ; to PAT-004 tick values via DURATION_KEYS', () => {
    expect(DURATION_KEYS.h).toBe(192);
    expect(DURATION_KEYS.j).toBe(96);
    expect(DURATION_KEYS.k).toBe(48);
    expect(DURATION_KEYS.l).toBe(24);
    expect(DURATION_KEYS[';']).toBe(12);
  });

  it('exposes the same map through DURATION_KEY_TICKS alias for shortcut-layer consumers', () => {
    expect(DURATION_KEY_TICKS).toBe(DURATION_KEYS);
  });

  it('updates currentDurationTicks when k is pressed and the grid canvas is focused', () => {
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    const setCurrentDurationTicks = vi.fn();
    const ctx = makeCtx({ setCurrentDurationTicks });
    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'k', bubbles: true }), ctx);
    expect(setCurrentDurationTicks).toHaveBeenCalledWith(48);
  });
});

describe('editor keyboard — Task 7.1 — digit entry (table mode)', () => {
  it('adds a diatonic chord on digit 5 with collapsed table caret and canvas focus', () => {
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    const onChordEdit = vi.fn();
    const ctx = makeCtx({ onChordEdit });
    handleEditorKeydown(new KeyboardEvent('keydown', { key: '5', bubbles: true }), ctx);
    expect(onChordEdit).toHaveBeenCalledTimes(1);
    expect(onChordEdit.mock.calls[0]?.[1]).toMatchObject({ type: 'add', chord: expect.objectContaining({ scaleDegree: 5 }) });
  });
});

describe('editor keyboard — Task 7.1 — entry mode toggle (Tab)', () => {
  it('invokes onToggleEntryMode when Tab is pressed outside editable targets', () => {
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    const onToggleEntryMode = vi.fn();
    const ctx = makeCtx({ onToggleEntryMode });
    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }), ctx);
    expect(onToggleEntryMode).toHaveBeenCalledTimes(1);
  });
});

describe('editor keyboard — Task 7.1 — Ctrl+digit melody voice', () => {
  it('sets active voice from Ctrl+2 (TASK-5.7)', () => {
    const setActiveVoice = vi.fn();
    const ctx = makeCtx({ setActiveVoice });
    handleEditorKeydown(
      new KeyboardEvent('keydown', { key: '2', code: 'Digit2', ctrlKey: true, bubbles: true }),
      ctx,
    );
    expect(setActiveVoice).toHaveBeenCalledWith(1);
  });
});

describe('editor keyboard — Task 7.1 — text mode gating', () => {
  it('does not add a chord on digit when text mode is active and duration is not armed', () => {
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    const onChordEdit = vi.fn();
    const ctx = makeCtx({ entryMode: 'text', textDurationArmedRef: { current: false }, onChordEdit });
    handleEditorKeydown(new KeyboardEvent('keydown', { key: '4', bubbles: true }), ctx);
    expect(onChordEdit).not.toHaveBeenCalled();
  });
});
