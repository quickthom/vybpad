/**
 * TASK-5.1 — Chord palette insertion uses the same measure/beat resolution as digit keys
 * (`applyChordScaleDegreeFromEditor` / `buildDiatonicChordPayload`).
 */
import type { ChordEditAction, Viewport } from '@vybpad/shared';
import { describe, expect, it, vi } from 'vitest';

import { applyChordScaleDegreeFromEditor, type EditorKeyboardContext } from '../../../src/hooks/useKeyboard';
import { buildDefaultSong } from '../../../src/store/songStore';

const BASE_VIEWPORT: Viewport = { startMeasure: 0, measureCount: 8, scrollY: 0, zoom: 1 };

function makeCtx(overrides: Partial<EditorKeyboardContext>): EditorKeyboardContext {
  const song = buildDefaultSong();
  return {
    song,
    viewport: BASE_VIEWPORT,
    selection: { type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 },
    activeVoice: 0,
    entryMode: 'table',
    currentDurationTicks: 48,
    setCurrentDurationTicks: vi.fn(),
    keyboardTargetMeasureRef: { current: null },
    textDurationArmedRef: { current: false },
    onChordEdit: vi.fn(),
    onNoteEdit: vi.fn(),
    onSelectionChange: vi.fn(),
    ...overrides,
  };
}

describe('applyChordScaleDegreeFromEditor — TASK-5.1 placement', () => {
  it('inserts at beat 0 in measure 0 for collapsed range caret at 0 (matches digit path)', () => {
    const onChordEdit = vi.fn<(measureIndex: number, event: ChordEditAction) => void>();
    const ctx = makeCtx({
      onChordEdit,
      selection: { type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 },
      viewport: { startMeasure: 3, measureCount: 8, scrollY: 0, zoom: 1 },
    });

    const ok = applyChordScaleDegreeFromEditor(ctx, 4);
    expect(ok).toBe(true);
    expect(onChordEdit).toHaveBeenCalledTimes(1);
    const [measureIndex, action] = onChordEdit.mock.calls[0]!;
    expect(measureIndex).toBe(0);
    expect(action.type).toBe('add');
    if (action.type === 'add') {
      expect(action.chord.beat).toBe(0);
      expect(action.chord.scaleDegree).toBe(4);
      expect(action.chord.duration).toBe(48);
    }
  });

  it('targets viewport start measure when selection is null (fixed viewport)', () => {
    const onChordEdit = vi.fn<(measureIndex: number, event: ChordEditAction) => void>();
    const ctx = makeCtx({
      onChordEdit,
      selection: null,
      viewport: { startMeasure: 5, measureCount: 8, scrollY: 0, zoom: 1 },
    });

    const ok = applyChordScaleDegreeFromEditor(ctx, 1);
    expect(ok).toBe(true);
    expect(onChordEdit.mock.calls[0]![0]).toBe(5);
  });
});
