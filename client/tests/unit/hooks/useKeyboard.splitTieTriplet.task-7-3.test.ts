/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-7.3
 *
 * Criterion 1: With editor focus + valid selection, `/` splits, `t` ties, Shift+T toggles triplet duration per PAT-004 / product rules.
 * Criterion 3: Undo restores prior song in one step per user command (see songStore test).
 * Criterion 4: Invalid selection — no store corruption; onNoteEdit/onChordEdit may be no-ops.
 *
 * Wiring under test mirrors {@link EditorLayout} `durationShortcutCommandRef`: duration commands map to ticks;
 * TASK-7.3 requires the same handler to branch on splitSelection | tieSelection | toggleTriplet (or delegate to useKeyboard).
 */

import type { NoteEvent, Selection, SongData, Viewport } from '@vybpad/shared';
import { randomUUID } from 'node:crypto';

import { createShortcutManager } from '@/engine/keyboard/shortcutManager';
import type { ShortcutCommandId, ShortcutContext, ShortcutDefinition, ShortcutManager } from '@/engine/keyboard/shortcutTypes';
import { TASK73_EDITOR_SHORTCUT_CHORDS } from '@/engine/keyboard/task73ShortcutChords';
import {
  applyDurationTicksFromEditor,
  applyNoteShortcutCommandFromEditor,
  type EditorKeyboardContext,
  handleEditorKeydown,
} from '@/hooks/useKeyboard';
import { afterEach, describe, expect, it, vi } from 'vitest';

const viewport: Viewport = { startMeasure: 0, measureCount: 8, scrollY: 0, zoom: 1 };

/** Same map as `EditorLayout` NOTE_DURATION_COMMAND_TICKS (TASK-7.2). */
const NOTE_DURATION_COMMAND_TICKS: Partial<Record<ShortcutCommandId, number>> = {
  setNoteDurationWhole: 192,
  setNoteDurationHalf: 96,
  setNoteDurationQuarter: 48,
  setNoteDurationEighth: 24,
  setNoteDurationSixteenth: 12,
  setNoteDurationThirtySecond: 6,
};

function keydown(
  init: Partial<KeyboardEventInit & { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }>,
): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

/** Mirrors {@link EditorLayout} `durationShortcutCommandRef` / TASK-7.3 branch (duration + split/tie/triplet). */
function editorLayoutStyleOnCommand(id: ShortcutCommandId, ctx: EditorKeyboardContext): void {
  if (id === 'splitSelection' || id === 'tieSelection' || id === 'toggleTriplet') {
    applyNoteShortcutCommandFromEditor(
      ctx,
      id as 'splitSelection' | 'tieSelection' | 'toggleTriplet',
    );
    return;
  }
  const ticks = NOTE_DURATION_COMMAND_TICKS[id];
  if (ticks !== undefined) applyDurationTicksFromEditor(ctx, ticks);
}

function registerTask73Bindings(mgr: ShortcutManager): void {
  const rows: { id: keyof typeof TASK73_EDITOR_SHORTCUT_CHORDS }[] = [
    { id: 'splitSelection' },
    { id: 'tieSelection' },
    { id: 'toggleTriplet' },
  ];
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

function makeSongWithNotes(notes: NoteEvent[]): SongData {
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
        notes: [notes, [], [], []],
      },
    ],
  };
}

function routeEditorKeydown(e: KeyboardEvent, ctx: EditorKeyboardContext): void {
  const mgr = ctx.shortcutManager;
  const getCtx = ctx.getShortcutContext;
  if (mgr && getCtx) {
    if (mgr.handleKeyDown(e, getCtx())) return;
  }
  handleEditorKeydown(e, ctx);
}

function makeCtx(
  overrides: Partial<EditorKeyboardContext> & Partial<{ getShortcutContext: () => ShortcutContext }> = {},
): EditorKeyboardContext {
  const noteId = randomUUID();
  const note: NoteEvent = {
    id: noteId,
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    beat: 0,
    duration: 48,
    isRest: false,
    velocity: 100,
  };
  const song = overrides.song ?? makeSongWithNotes([note]);
  const selection: Selection = overrides.selection ?? { type: 'note', measureIndex: 0, eventIds: [noteId] };

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
    getSongAfterMutation: () => song,
    getSelectionAfterMutation: () => selection,
    onChordEdit: vi.fn(),
    onNoteEdit: vi.fn(),
    onSelectionChange: vi.fn(),
    ...overrides,
  };
}

describe('TASK-7.3 — split / tie / triplet shell wiring (useKeyboard + ShortcutContext)', () => {
  afterEach(() => {
    document.body.replaceChildren();
    (document.body as HTMLElement).focus?.();
  });

  it('with valid single-note selection, / dispatches splitSelection and applies a note-affecting edit (Builder: split)', () => {
    const onNoteEdit = vi.fn();
    const ctx = makeCtx({ onNoteEdit });

    const mgr = createShortcutManager({
      onCommand: (id) => editorLayoutStyleOnCommand(id, ctx),
    });
    registerTask73Bindings(mgr);

    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    routeEditorKeydown(keydown({ key: '/', code: 'Slash' }), {
      ...ctx,
      shortcutManager: mgr,
      getShortcutContext: () => ({
        hasModalOpen: false,
        isTextEditing: false,
        hasEditorFocus: true,
        isPlaying: false,
      }),
    });

    expect(onNoteEdit).toHaveBeenCalled();
  });

  it('with two adjacent same-pitch notes selected, t dispatches tieSelection and merges via note edit(s) (Builder: tie)', () => {
    const a = randomUUID();
    const b = randomUUID();
    const n1: NoteEvent = {
      id: a,
      scaleDegree: 1,
      octave: 0,
      chromatic: 0,
      beat: 0,
      duration: 24,
      isRest: false,
      velocity: 100,
    };
    const n2: NoteEvent = {
      id: b,
      scaleDegree: 1,
      octave: 0,
      chromatic: 0,
      beat: 24,
      duration: 24,
      isRest: false,
      velocity: 100,
    };
    const onNoteEdit = vi.fn();
    const song = makeSongWithNotes([n1, n2]);
    const selection: Selection = { type: 'note', measureIndex: 0, eventIds: [a, b] };
    const ctx = makeCtx({
      song,
      selection,
      getSongAfterMutation: () => song,
      getSelectionAfterMutation: () => selection,
      onNoteEdit,
    });

    const mgr = createShortcutManager({
      onCommand: (id) => editorLayoutStyleOnCommand(id, ctx),
    });
    registerTask73Bindings(mgr);

    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    routeEditorKeydown(keydown({ key: 't', code: 'KeyT' }), {
      ...ctx,
      shortcutManager: mgr,
      getShortcutContext: () => ({
        hasModalOpen: false,
        isTextEditing: false,
        hasEditorFocus: true,
        isPlaying: false,
      }),
    });

    expect(onNoteEdit).toHaveBeenCalled();
  });

  it('with eighth note selected, Shift+T dispatches toggleTriplet and adjusts duration per PAT-004 (24 ↔ 16)', () => {
    const noteId = randomUUID();
    const note: NoteEvent = {
      id: noteId,
      scaleDegree: 2,
      octave: 0,
      chromatic: 0,
      beat: 0,
      duration: 24,
      isRest: false,
      velocity: 100,
    };
    const onNoteEdit = vi.fn();
    const song = makeSongWithNotes([note]);
    const selection: Selection = { type: 'note', measureIndex: 0, eventIds: [noteId] };
    const ctx = makeCtx({
      song,
      selection,
      getSongAfterMutation: () => song,
      getSelectionAfterMutation: () => selection,
      onNoteEdit,
    });

    const mgr = createShortcutManager({
      onCommand: (id) => editorLayoutStyleOnCommand(id, ctx),
    });
    registerTask73Bindings(mgr);

    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    routeEditorKeydown(keydown({ key: 'T', code: 'KeyT', shiftKey: true }), {
      ...ctx,
      shortcutManager: mgr,
      getShortcutContext: () => ({
        hasModalOpen: false,
        isTextEditing: false,
        hasEditorFocus: true,
        isPlaying: false,
      }),
    });

    expect(onNoteEdit).toHaveBeenCalledWith(
      0,
      0,
      expect.objectContaining({
        type: 'resize',
        noteId,
        newDuration: 16,
      }),
    );
  });

  it('does not fire shell split when getShortcutContext.hasModalOpen (same gate as TASK-7.2)', () => {
    const onNoteEdit = vi.fn();
    const ctx = makeCtx({ onNoteEdit });

    const mgr = createShortcutManager({
      onCommand: (id) => editorLayoutStyleOnCommand(id, ctx),
    });
    registerTask73Bindings(mgr);

    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    routeEditorKeydown(keydown({ key: '/', code: 'Slash' }), {
      ...ctx,
      shortcutManager: mgr,
      getShortcutContext: () => ({
        hasModalOpen: true,
        isTextEditing: false,
        hasEditorFocus: true,
        isPlaying: false,
      }),
    });

    expect(onNoteEdit).not.toHaveBeenCalled();
  });

  it('does not fire shell tie when getShortcutContext.hasEditorFocus is false', () => {
    const onNoteEdit = vi.fn();
    const ctx = makeCtx({ onNoteEdit });

    const mgr = createShortcutManager({
      onCommand: (id) => editorLayoutStyleOnCommand(id, ctx),
    });
    registerTask73Bindings(mgr);

    routeEditorKeydown(keydown({ key: 't', code: 'KeyT' }), {
      ...ctx,
      shortcutManager: mgr,
      getShortcutContext: () => ({
        hasModalOpen: false,
        isTextEditing: false,
        hasEditorFocus: false,
        isPlaying: false,
      }),
    });

    expect(onNoteEdit).not.toHaveBeenCalled();
  });

  it('does not apply tie when getShortcutContext.isTextEditing (focus in editable control)', () => {
    const onNoteEdit = vi.fn();
    const ctx = makeCtx({ onNoteEdit });

    const mgr = createShortcutManager({
      onCommand: (id) => editorLayoutStyleOnCommand(id, ctx),
    });
    registerTask73Bindings(mgr);

    routeEditorKeydown(keydown({ key: 't', code: 'KeyT' }), {
      ...ctx,
      shortcutManager: mgr,
      getShortcutContext: () => ({
        hasModalOpen: false,
        isTextEditing: true,
        hasEditorFocus: true,
        isPlaying: false,
      }),
    });

    expect(onNoteEdit).not.toHaveBeenCalled();
  });

  it('with chord-only selection, / is a no-op for notes (does not corrupt; onNoteEdit not called for split)', () => {
    const chordId = randomUUID();
    const onNoteEdit = vi.fn();
    const song: SongData = {
      ...makeSongWithNotes([]),
      measures: [
        {
          ...makeSongWithNotes([]).measures[0],
          chords: [
            {
              id: chordId,
              scaleDegree: 1,
              quality: 'major',
              seventh: 'none',
              suspension: 'none',
              addition: 'none',
              inversion: 0,
              borrowed: null,
              secondary: null,
              beat: 0,
              duration: 96,
            },
          ],
        },
      ],
    };
    const selection: Selection = { type: 'chord', measureIndex: 0, eventIds: [chordId] };
    const ctx = makeCtx({
      song,
      selection,
      getSongAfterMutation: () => song,
      getSelectionAfterMutation: () => selection,
      onNoteEdit,
    });

    const mgr = createShortcutManager({
      onCommand: (id) => {
        editorLayoutStyleOnCommand(id, ctx);
      },
    });
    registerTask73Bindings(mgr);

    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    routeEditorKeydown(keydown({ key: '/', code: 'Slash' }), {
      ...ctx,
      shortcutManager: mgr,
      getShortcutContext: () => ({
        hasModalOpen: false,
        isTextEditing: false,
        hasEditorFocus: true,
        isPlaying: false,
      }),
    });

    expect(onNoteEdit).not.toHaveBeenCalled();
  });
});
