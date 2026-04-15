/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-7.5
 *
 * Criterion: PAT-027 single dispatch — when a navigation chord is owned by ShortcutManager, the legacy
 *   grid handler must not also run (no double selection move / double preventDefault semantics).
 *   happy: mgr.handleKeyDown returns true → handleEditorKeydown not invoked for ArrowLeft/Right
 *   error: —
 *   edges: mgr returns false → legacy ArrowLeft still navigates selection (until fully migrated)
 *
 * Criterion: ShortcutManager dispatches `moveSelectionLeft` / `moveSelectionRight` for editor arrow chords.
 *   happy: registered ArrowLeft → onCommand('moveSelectionLeft')
 *   error: modal open → no dispatch
 *
 * ASSUMPTIONS:
 * - Mirrors `useKeyboard` listener order: registry first, then `handleEditorKeydown` (PAT-027).
 * - Chord strings for arrows use token `ArrowLeft` / `ArrowRight` (see shortcutManager tokenFromKeyboardEventKey).
 */

import type { ChordEvent } from '@vybpad/shared';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { createShortcutManager } from '@/engine/keyboard/shortcutManager';
import type { ShortcutCommandId, ShortcutContext } from '@/engine/keyboard/shortcutTypes';
import { handleEditorKeydown, type EditorKeyboardContext } from '@/hooks/useKeyboard';
import { buildDefaultSong } from '@/store/songStore';

function baseShortcutCtx(over: Partial<ShortcutContext> = {}): ShortcutContext {
  return {
    hasModalOpen: false,
    isTextEditing: false,
    hasEditorFocus: true,
    isPlaying: false,
    ...over,
  };
}

/** Same control-flow as `useKeyboard` capture listener (registry first, then legacy editor handler). */
function runShellKeyboardDispatch(ctx: EditorKeyboardContext, ev: KeyboardEvent): void {
  const mgr = ctx.shortcutManager;
  const g = ctx.getShortcutContext;
  if (mgr && g && mgr.handleKeyDown(ev, g())) return;
  handleEditorKeydown(ev, ctx);
}

/** Two chords in measure 0 so `navigateSelection` can move right with a deterministic target. */
function makeSongWithTwoChordSelection(): { song: SongData; selection: Selection } {
  const song = buildDefaultSong();
  const idA = crypto.randomUUID();
  const idB = crypto.randomUUID();
  const shared = {
    quality: 'major' as const,
    seventh: 'none' as const,
    suspension: 'none' as const,
    addition: 'none' as const,
    inversion: 0 as const,
    borrowed: null,
    secondary: null,
  };
  song.measures[0]!.chords = [
    { id: idA, scaleDegree: 1, ...shared, beat: 0, duration: 48 },
    { id: idB, scaleDegree: 4, ...shared, beat: 48, duration: 48 },
  ];
  return {
    song,
    selection: { type: 'chord', measureIndex: 0, eventIds: [idA] },
  };
}

function minimalChord(beat: number): ChordEvent {
  return {
    id: randomUUID(),
    scaleDegree: 1,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat,
    duration: 48,
  };
}

function makeBaseCtx(overrides: Partial<EditorKeyboardContext> = {}): EditorKeyboardContext {
  const song = buildDefaultSong();
  // Two chords on the merged timeline so ArrowRight can advance from the first (TASK-7.5 legacy path).
  song.measures[0].chords = [minimalChord(0), minimalChord(96)];
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
    getShortcutContext: () => baseShortcutCtx(),
    ...overrides,
  };
}

describe('TASK-7.5 — navigation shortcuts — shell dispatch layering (PAT-027)', () => {
  it('does not invoke legacy ArrowLeft selection navigation when ShortcutManager consumes ArrowLeft (no duplicate handling)', () => {
    const onRegistry = vi.fn<(id: ShortcutCommandId) => void>();
    const mgr = createShortcutManager({ onCommand: onRegistry });
    mgr.registerShortcut({
      id: 'moveSelectionLeft',
      chord: 'ArrowLeft',
      scope: 'editor',
      conflictPolicy: 'replace',
    });

    const onSelectionChange = vi.fn();
    const ctx = makeBaseCtx({
      shortcutManager: mgr,
      onSelectionChange,
    });

    const ev = new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true, cancelable: true });
    runShellKeyboardDispatch(ctx, ev);

    expect(onRegistry).toHaveBeenCalledTimes(1);
    expect(onRegistry).toHaveBeenCalledWith('moveSelectionLeft');
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('invokes legacy ArrowRight navigation when ShortcutManager does not register ArrowRight', () => {
    const onRegistry = vi.fn<(id: ShortcutCommandId) => void>();
    const mgr = createShortcutManager({ onCommand: onRegistry });
    mgr.registerShortcut({
      id: 'moveSelectionLeft',
      chord: 'ArrowLeft',
      scope: 'editor',
      conflictPolicy: 'replace',
    });

    const onSelectionChange = vi.fn();
    const { song, selection } = makeSongWithTwoChordSelection();
    const ctx = makeBaseCtx({
      song,
      selection,
      shortcutManager: mgr,
      getSongAfterMutation: () => song,
      getSelectionAfterMutation: () => selection,
      onSelectionChange,
    });

    const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true });
    runShellKeyboardDispatch(ctx, ev);

    expect(onRegistry).not.toHaveBeenCalled();
    expect(onSelectionChange).toHaveBeenCalled();
  });

  it('does not dispatch moveSelectionRight while a modal is open (ShortcutContext fail closed)', () => {
    const onRegistry = vi.fn<(id: ShortcutCommandId) => void>();
    const mgr = createShortcutManager({ onCommand: onRegistry });
    mgr.registerShortcut({
      id: 'moveSelectionRight',
      chord: 'ArrowRight',
      scope: 'editor',
      conflictPolicy: 'replace',
    });

    const ctx = makeBaseCtx({
      shortcutManager: mgr,
      getShortcutContext: () => baseShortcutCtx({ hasModalOpen: true }),
    });

    const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true });
    runShellKeyboardDispatch(ctx, ev);

    expect(onRegistry).not.toHaveBeenCalled();
  });
});
