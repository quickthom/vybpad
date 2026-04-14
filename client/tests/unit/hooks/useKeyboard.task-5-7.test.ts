/** @vitest-environment jsdom */

import type { Selection, SongData, Viewport } from '@vybpad/shared';
import { randomUUID } from 'node:crypto';

import type { EditorKeyboardContext } from '../../../src/hooks/useKeyboard';
import { handleEditorKeydown } from '../../../src/hooks/useKeyboard';
import { afterEach, describe, expect, it, vi } from 'vitest';

const viewport: Viewport = { startMeasure: 0, measureCount: 8, scrollY: 0, zoom: 1 };

function makeSongFirstMeasureEmpty(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'T',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    bandConfig: {
      tracks: [
        { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
        { role: 'melody2', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
        { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
        { role: 'drums', instrument: 'piano', volume: 0.0, mute: true, octave: 0 },
      ],
    },
    measures: [
      {
        id: randomUUID(),
        chords: [],
        notes: [[], [], [], []],
      },
    ],
  };
}

function makeCtx(overrides: Partial<EditorKeyboardContext> = {}): EditorKeyboardContext {
  const song = makeSongFirstMeasureEmpty();
  const selection: Selection = { type: 'note', measureIndex: 0, eventIds: [] };
  return {
    song,
    viewport,
    selection,
    activeVoice: 0,
    setActiveVoice: vi.fn(),
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

describe('handleEditorKeydown — TASK-5.7 multiple melody voices', () => {
  afterEach(() => {
    document.body.replaceChildren();
    (document.body as HTMLElement).focus?.();
  });

  it('Ctrl+Digit1–4 calls setActiveVoice with 0–3 (uses e.code)', () => {
    const setActiveVoice = vi.fn();
    const ctx = makeCtx({ setActiveVoice, selection: null });

    handleEditorKeydown(
      new KeyboardEvent('keydown', { key: '3', code: 'Digit3', ctrlKey: true, bubbles: true, cancelable: true }),
      ctx,
    );
    expect(setActiveVoice).toHaveBeenCalledTimes(1);
    expect(setActiveVoice).toHaveBeenCalledWith(2);

    handleEditorKeydown(
      new KeyboardEvent('keydown', { key: '1', code: 'Digit1', metaKey: true, bubbles: true, cancelable: true }),
      ctx,
    );
    expect(setActiveVoice).toHaveBeenCalledWith(0);
  });

  it('table-mode digit targets activeVoice when no note id is selected (empty eventIds)', () => {
    const onNoteEdit = vi.fn();
    const ctx = makeCtx({
      activeVoice: 3,
      selection: { type: 'note', measureIndex: 0, eventIds: [] },
      onNoteEdit,
    });

    handleEditorKeydown(new KeyboardEvent('keydown', { key: '5', bubbles: true, cancelable: true }), ctx);

    expect(onNoteEdit).toHaveBeenCalled();
    expect(onNoteEdit.mock.calls[0]?.[1]).toBe(3);
    expect(onNoteEdit.mock.calls[0]?.[2]).toMatchObject({ type: 'add' });
  });
});
