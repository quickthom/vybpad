/** @vitest-environment jsdom */

import type { EditorKeyboardContext } from '../../../src/hooks/useKeyboard';
import { handleEditorKeydown } from '../../../src/hooks/useKeyboard';
import { buildDefaultSong } from '../../../src/store/songStore';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('handleEditorKeydown — editable focus guard (TASK-4.2)', () => {
  afterEach(() => {
    document.body.replaceChildren();
    (document.body as HTMLElement).focus?.();
  });

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

  it('ignores digit keys while a number input is focused (e.g. transport tempo)', () => {
    const input = document.createElement('input');
    input.type = 'number';
    document.body.append(input);
    input.focus();

    const onChordEdit = vi.fn();
    const ctx = makeCtx({ onChordEdit });
    handleEditorKeydown(new KeyboardEvent('keydown', { key: '1', bubbles: true }), ctx);
    expect(onChordEdit).not.toHaveBeenCalled();
  });

  it('dispatches chord add when focus is on the grid canvas', () => {
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    const onChordEdit = vi.fn();
    const ctx = makeCtx({ onChordEdit });
    handleEditorKeydown(new KeyboardEvent('keydown', { key: '1', bubbles: true }), ctx);
    expect(onChordEdit).toHaveBeenCalledTimes(1);
    expect(onChordEdit.mock.calls[0]?.[1]).toMatchObject({ type: 'add' });
  });
});
