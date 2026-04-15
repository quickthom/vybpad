/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-7.2
 *
 * Criterion 2: Handling a duration shortcut matches duration application: table resize when applicable;
 *   text mode arms duration; currentDurationTicks updates.
 *   happy: table + single note/chord selection → resize; text → armed + ticks; ticks always updated first.
 *   error: n/a
 *   edges: thirty-second → 6 ticks (PAT-004 / INTERFACES)
 *
 * Criterion 3: Context — no editor duration when modal open; gating vs text editing and canvas/editor focus
 *   (ShortcutManager + ShortcutContext).
 *   happy: shortcut layer suppresses editor bindings when hasModalOpen / hasEditorFocus false.
 *   error: grid must not fall through to legacy duration handling when shortcut routing is active (see tests).
 *
 * Public surfaces: same ordering as useKeyboard (shortcut manager first), handleEditorKeydown, EditorKeyboardContext.
 */

import type { NoteEvent, Selection, SongData, Viewport } from '@vybpad/shared';
import { randomUUID } from 'node:crypto';

import { clampDurationToMeasure } from '@/components/editor/editorKeyboardLogic';
import { chordFromKeyboardEvent, createShortcutManager } from '@/engine/keyboard/shortcutManager';
import type { ShortcutCommandId, ShortcutContext, ShortcutDefinition, ShortcutManager } from '@/engine/keyboard/shortcutTypes';
import { type EditorKeyboardContext, handleEditorKeydown } from '@/hooks/useKeyboard';
import { afterEach, describe, expect, it, vi } from 'vitest';

const viewport: Viewport = { startMeasure: 0, measureCount: 8, scrollY: 0, zoom: 1 };

/** PAT-004 / INTERFACES granular duration commands → ticks. */
const TICKS_BY_DURATION_COMMAND = {
  setNoteDurationWhole: 192,
  setNoteDurationHalf: 96,
  setNoteDurationQuarter: 48,
  setNoteDurationEighth: 24,
  setNoteDurationSixteenth: 12,
  setNoteDurationThirtySecond: 6,
} as const satisfies Record<
  | 'setNoteDurationWhole'
  | 'setNoteDurationHalf'
  | 'setNoteDurationQuarter'
  | 'setNoteDurationEighth'
  | 'setNoteDurationSixteenth'
  | 'setNoteDurationThirtySecond',
  number
>;

type DurationCommandId = keyof typeof TICKS_BY_DURATION_COMMAND;

function findVoiceForNote(song: SongData, measureIndex: number, noteId: string): 0 | 1 | 2 | 3 | null {
  const m = song.measures[measureIndex];
  if (!m) return null;
  for (const v of [0, 1, 2, 3] as const) {
    if (m.notes[v].some((n) => n.id === noteId)) return v;
  }
  return null;
}

/**
 * Oracle for TASK-7.2 behavior — mirrors {@link handleEditorKeydown}'s duration application (`applyDurationKey`)
 * so tests stay tied to documented UX, not a particular Builder helper location.
 */
function applyDurationTicksFromCommand(ctx: EditorKeyboardContext, command: DurationCommandId): void {
  const ticks = TICKS_BY_DURATION_COMMAND[command];
  const rounded = Math.round(ticks);
  ctx.setCurrentDurationTicks(rounded);
  if (ctx.entryMode === 'text') {
    ctx.textDurationArmedRef.current = true;
    return;
  }
  const selection = ctx.getSelectionAfterMutation?.() ?? ctx.selection;
  const id = selection?.eventIds?.[0];
  if (!id || !selection || selection.type === 'range') return;
  if (selection.type === 'chord') {
    const ch = ctx.song.measures[selection.measureIndex]?.chords.find((c) => c.id === id);
    if (!ch) return;
    const nd = clampDurationToMeasure(ctx.song, selection.measureIndex, ch.beat, rounded);
    if (nd !== ch.duration) ctx.onChordEdit(selection.measureIndex, { type: 'resize', chordId: id, newDuration: nd });
  } else if (selection.type === 'note') {
    const voice = findVoiceForNote(ctx.song, selection.measureIndex, id);
    if (voice == null) return;
    const note = ctx.song.measures[selection.measureIndex]?.notes[voice].find((n) => n.id === id);
    if (!note) return;
    const nd = clampDurationToMeasure(ctx.song, selection.measureIndex, note.beat, rounded);
    if (nd !== note.duration) ctx.onNoteEdit(selection.measureIndex, voice, { type: 'resize', noteId: id, newDuration: nd });
  }
}

function keydown(
  init: Partial<KeyboardEventInit & { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }>,
): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

/** Mirrors `useKeyboard` capture listener: shortcut layer runs first; only then the grid editor. */
function routeEditorKeydown(e: KeyboardEvent, ctx: EditorKeyboardContext): void {
  const mgr = ctx.shortcutManager;
  const getCtx = ctx.getShortcutContext;
  if (mgr && getCtx) {
    if (mgr.handleKeyDown(e, getCtx())) return;
  }
  handleEditorKeydown(e, ctx);
}

function registerTask72DurationBindings(mgr: ShortcutManager): void {
  const rows: { init: Partial<KeyboardEventInit>; id: DurationCommandId; enabled?: boolean }[] = [
    { init: { key: 'h', code: 'KeyH' }, id: 'setNoteDurationWhole' },
    { init: { key: 'j', code: 'KeyJ' }, id: 'setNoteDurationHalf' },
    { init: { key: 'k', code: 'KeyK' }, id: 'setNoteDurationQuarter' },
    { init: { key: 'l', code: 'KeyL' }, id: 'setNoteDurationEighth' },
    { init: { key: ';', code: 'Semicolon' }, id: 'setNoteDurationSixteenth' },
    { init: { key: '`', code: 'Backquote' }, id: 'setNoteDurationThirtySecond', enabled: true },
    { init: { key: "'", code: 'Quote' }, id: 'setNoteDurationThirtySecond', enabled: true },
    { init: { key: 'q', code: 'KeyQ' }, id: 'setNoteDurationWhole' },
    { init: { key: 'w', code: 'KeyW' }, id: 'setNoteDurationHalf' },
    { init: { key: 'e', code: 'KeyE' }, id: 'setNoteDurationQuarter' },
    { init: { key: 'r', code: 'KeyR' }, id: 'setNoteDurationEighth' },
    { init: { key: 't', code: 'KeyT' }, id: 'setNoteDurationSixteenth' },
  ];

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

function makeSongWithOneNote(note: NoteEvent): SongData {
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
        notes: [[note], [], [], []],
      },
    ],
  };
}

function makeCtx(overrides: Partial<EditorKeyboardContext> & Partial<{ getShortcutContext: () => ShortcutContext }> = {}): EditorKeyboardContext {
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
  const song = overrides.song ?? makeSongWithOneNote(note);
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

describe('TASK-7.2 — note duration shortcuts (useKeyboard + ShortcutContext)', () => {
  afterEach(() => {
    document.body.replaceChildren();
    (document.body as HTMLElement).focus?.();
  });

  it('updates currentDurationTicks and resizes the selected note in table mode when the manager dispatches setNoteDurationEighth', () => {
    const onNoteEdit = vi.fn();
    const setCurrentDurationTicks = vi.fn();
    const ctx = makeCtx({ onNoteEdit, setCurrentDurationTicks });

    const mgr = createShortcutManager({
      onCommand: (id) => {
        if (id in TICKS_BY_DURATION_COMMAND) applyDurationTicksFromCommand(ctx, id as DurationCommandId);
      },
    });
    registerTask72DurationBindings(mgr);

    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    routeEditorKeydown(keydown({ key: 'l', code: 'KeyL' }), { ...ctx, shortcutManager: mgr, getShortcutContext: () => ({
      hasModalOpen: false,
      isTextEditing: false,
      hasEditorFocus: true,
      isPlaying: false,
    }) });

    expect(setCurrentDurationTicks).toHaveBeenCalledWith(24);
    expect(onNoteEdit).toHaveBeenCalledWith(
      0,
      0,
      expect.objectContaining({ type: 'resize', newDuration: 24 }),
    );
  });

  it('arms text duration and updates currentDurationTicks when the manager dispatches setNoteDurationQuarter in text mode', () => {
    const textDurationArmedRef = { current: false };
    const setCurrentDurationTicks = vi.fn();
    const ctx = makeCtx({
      entryMode: 'text',
      textDurationArmedRef,
      setCurrentDurationTicks,
      selection: { type: 'chord', measureIndex: 0, eventIds: [randomUUID()] },
    });

    const mgr = createShortcutManager({
      onCommand: (id) => {
        if (id in TICKS_BY_DURATION_COMMAND) applyDurationTicksFromCommand(ctx, id as DurationCommandId);
      },
    });
    registerTask72DurationBindings(mgr);

    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    routeEditorKeydown(keydown({ key: 'k', code: 'KeyK' }), { ...ctx, shortcutManager: mgr, getShortcutContext: () => ({
      hasModalOpen: false,
      isTextEditing: false,
      hasEditorFocus: true,
      isPlaying: false,
    }) });

    expect(setCurrentDurationTicks).toHaveBeenCalledWith(48);
    expect(textDurationArmedRef.current).toBe(true);
  });

  it('does not apply legacy PAT-004 duration keys when getShortcutContext.hasModalOpen (shell must gate or remove fall-through)', () => {
    const setCurrentDurationTicks = vi.fn();
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    const ctx = makeCtx({
      setCurrentDurationTicks,
      shortcutManager: null,
      getShortcutContext: () => ({
        hasModalOpen: true,
        isTextEditing: false,
        hasEditorFocus: true,
        isPlaying: false,
      }),
    });

    handleEditorKeydown(keydown({ key: 'k', code: 'KeyK' }), ctx);
    expect(setCurrentDurationTicks).not.toHaveBeenCalled();
  });

  it('does not apply legacy PAT-004 duration keys when getShortcutContext.hasEditorFocus is false', () => {
    const setCurrentDurationTicks = vi.fn();
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();

    const ctx = makeCtx({
      setCurrentDurationTicks,
      shortcutManager: null,
      getShortcutContext: () => ({
        hasModalOpen: false,
        isTextEditing: false,
        hasEditorFocus: false,
        isPlaying: false,
      }),
    });

    handleEditorKeydown(keydown({ key: 'k', code: 'KeyK' }), ctx);
    expect(setCurrentDurationTicks).not.toHaveBeenCalled();
  });
});
