import type {
  ChordEditAction,
  ChordEvent,
  NoteEvent,
  NoteEditAction,
  ScaleDegree,
  Selection,
  SongData,
  Viewport,
} from '@vybpad/shared';
import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';

import {
  buildDefaultNotePayload,
  buildDiatonicChordPayload,
  buildRestNotePayload,
  clampDurationToMeasure,
  cycleSecondaryChordEdit,
  DURATION_KEYS,
  entryEndsAtOrPastMeasureEnd,
  findNoteIdByPlacement,
  isEditableKeyboardTarget,
  navigateSelection,
  nextCycledEmbellishment,
  nextCycledInversion,
  pickSmartOctaveForDegreeEdit,
  pickSmartOctaveForNewNote,
  resolveMeasureIndexForKeyboardDigit,
  shouldAllowChordDigitEntry,
  shouldUseNoteEntry,
  tableInsertBeatFromSelection,
  tableModeAdvanceRange,
} from '../components/editor/editorKeyboardLogic';
import {
  findVoiceForNote,
  type NoteBatchOperation,
  planSplitNote,
  planTieNote,
  planTripletToggle,
  selectionAfterSplit,
  selectionAfterTie,
  splitMidpointParts,
} from '../components/editor/noteCommands';
import type { ShortcutContext, ShortcutManager, ShortcutCommandId } from '../engine/keyboard/shortcutTypes';
import { getKeyAtMeasure, getScaleAtMeasure } from '../engine/renderer/tickUtils';

/** PAT-004 — re-export for unit tests (alias of DURATION_KEYS). */
export const DURATION_KEY_TICKS: Record<string, number> = DURATION_KEYS;

export interface EditorKeyboardContext {
  song: SongData;
  viewport: Viewport;
  selection: Selection | null;
  activeVoice: 0 | 1 | 2 | 3;
  /** TASK-5.7 — Ctrl/Cmd+Digit1–4 switches active melody voice. */
  setActiveVoice: (v: 0 | 1 | 2 | 3) => void;
  entryMode: 'table' | 'text';
  currentDurationTicks: number;
  setCurrentDurationTicks: (n: number) => void;
  /** When table-mode advance crosses a barline, next digit resolves to the following measure. */
  keyboardTargetMeasureRef: MutableRefObject<number | null>;
  textDurationArmedRef: MutableRefObject<boolean>;
  /** After editChord/editNote, read authoritative song (App wires Zustand). Tests simulate with mocks. */
  getSongAfterMutation?: () => SongData;
  /** After selection changes, read authoritative selection so rapid key bursts use the latest caret. */
  getSelectionAfterMutation?: () => Selection | null;
  onToggleEntryMode?: () => void;
  onEntryModeToggle?: () => void;
  onChordEdit: (measureIndex: number, event: ChordEditAction) => void;
  onNoteEdit: (measureIndex: number, voice: number, event: NoteEditAction) => void;
  /** TASK-7.3 — single-undo batched note ops (split/tie); shell wires from `songStore.editNoteBatch`. */
  editNoteBatch?: (
    operations: ReadonlyArray<{ measureIndex: number; voice: 0 | 1 | 2 | 3; action: NoteEditAction }>,
  ) => void;
  onSelectionChange: (selection: Selection | null) => void;

  /** Optional PAT-027 layer; when set with {@link getShortcutContext}, runs before grid editor handling. */
  shortcutManager?: ShortcutManager | null;
  getShortcutContext?: () => ShortcutContext;

  /**
   * UI-W3 — left-panel "Chromatic" toggle. When true, new table-mode melody notes default to `chromatic: +1`
   * (one semitone sharp vs diatonic, PAT-018); text-mode degree edits apply `chromatic: 1` when changing pitch.
   * Omitted or false → diatonic placement (`chromatic: 0`) and text updates do not force chromatic.
   */
  melodyChromaticEntryActive?: boolean;
  /** UI-W4 — new table-mode notes / text-mode degree edits pick octave near prior pitch in the voice. */
  smartOctaveEnabled?: boolean;
}

function melodyDefaultChromaticOffset(ctx: EditorKeyboardContext): number {
  return ctx.melodyChromaticEntryActive === true ? 1 : 0;
}

function parseScaleDegreeKey(key: string): ScaleDegree | null {
  if (key >= '1' && key <= '7') return Number(key) as ScaleDegree;
  return null;
}

function pickSong(ctx: EditorKeyboardContext): SongData {
  return ctx.getSongAfterMutation?.() ?? ctx.song;
}

function pickSelection(ctx: EditorKeyboardContext): Selection | null {
  // Do not use `??`: authoritative `null` (no caret) must not fall back to a stale React prop.
  if (ctx.getSelectionAfterMutation) {
    return ctx.getSelectionAfterMutation();
  }
  return ctx.selection;
}

function applyNoteOperations(ctx: EditorKeyboardContext, ops: readonly NoteBatchOperation[]): void {
  if (ops.length === 0) return;
  if (ctx.editNoteBatch) {
    ctx.editNoteBatch(ops);
    return;
  }
  for (const op of ops) {
    ctx.onNoteEdit(op.measureIndex, op.voice, op.action);
  }
}

/** Keys dispatched via Phase 7 shortcut registry when {@link EditorKeyboardContext.shortcutManager} is set — avoid duplicate ad hoc handling (TASK-7.2). */
function isRegistryOwnedDurationKey(key: string, shortcutManager: ShortcutManager | null | undefined): boolean {
  if (!shortcutManager) return false;
  if (key === ';' || key === '`' || key === "'") return true;
  return key.length === 1 && /[hjkl]/i.test(key);
}

/**
 * When the shell supplies {@link EditorKeyboardContext.getShortcutContext}, PAT-027 duration keys must
 * fail closed like editor-scoped registry shortcuts (modal, text editing, canvas focus).
 */
function isEditorShortcutContextBlockingDuration(ctx: EditorKeyboardContext): boolean {
  const g = ctx.getShortcutContext?.();
  if (!g) return false;
  if (g.hasModalOpen) return true;
  if (g.isTextEditing) return true;
  if (!g.hasEditorFocus) return true;
  return false;
}

/**
 * TASK-7.2 — shared duration application: table vs text arming vs resize selection (same rules as legacy `applyDurationKey`).
 * Uses {@link pickSong} / {@link pickSelection} so store snapshots stay authoritative after mutations.
 */
export function applyDurationTicksFromEditor(ctx: EditorKeyboardContext, ticks: number): void {
  const rounded = Math.round(ticks);
  ctx.setCurrentDurationTicks(rounded);
  if (ctx.entryMode === 'text') {
    ctx.textDurationArmedRef.current = true;
    return;
  }
  const sel = pickSelection(ctx);
  const id = sel?.eventIds?.[0];
  if (!id || !sel || sel.type === 'range') return;
  const song = pickSong(ctx);
  if (sel.type === 'chord') {
    const ch = song.measures[sel.measureIndex]?.chords.find((c) => c.id === id);
    if (!ch) return;
    const nd = clampDurationToMeasure(song, sel.measureIndex, ch.beat, rounded);
    if (nd !== ch.duration) ctx.onChordEdit(sel.measureIndex, { type: 'resize', chordId: id, newDuration: nd });
  } else if (sel.type === 'note') {
    const voice = findVoiceForNote(song, sel.measureIndex, id);
    if (voice == null) return;
    const note = song.measures[sel.measureIndex]?.notes[voice].find((n) => n.id === id);
    if (!note) return;
    const nd = clampDurationToMeasure(song, sel.measureIndex, note.beat, rounded);
    if (nd !== note.duration) ctx.onNoteEdit(sel.measureIndex, voice, { type: 'resize', noteId: id, newDuration: nd });
  }
}

/**
 * TASK-7.3 — `splitSelection` / `tieSelection` / `toggleTriplet` from PAT-027 registry (EditorLayout `onCommand`).
 */
export function applyNoteShortcutCommandFromEditor(
  ctx: EditorKeyboardContext,
  id: Extract<ShortcutCommandId, 'splitSelection' | 'tieSelection' | 'toggleTriplet'>,
): void {
  const song = pickSong(ctx);
  const sel = pickSelection(ctx);

  if (id === 'splitSelection') {
    const ops = planSplitNote(song, sel);
    if (!ops) return;
    const noteId = sel?.type === 'note' ? sel.eventIds?.[0] : undefined;
    const measureIndex = sel?.measureIndex;
    if (noteId == null || measureIndex === undefined) return;
    const voice = findVoiceForNote(song, measureIndex, noteId);
    const note = voice != null ? song.measures[measureIndex]?.notes[voice].find((n) => n.id === noteId) : undefined;
    const parts = note ? splitMidpointParts(note) : null;
    applyNoteOperations(ctx, ops);
    if (parts && voice != null && ctx.editNoteBatch) {
      const songAfter = ctx.getSongAfterMutation?.();
      if (songAfter) {
        const nextSel = selectionAfterSplit(songAfter, measureIndex, voice, parts.splitBeat, parts.secondDuration);
        if (nextSel) ctx.onSelectionChange(nextSel);
      }
    }
    return;
  }

  if (id === 'tieSelection') {
    const ops = planTieNote(song, sel);
    if (!ops?.length) return;
    const first = ops[0];
    if (first.action.type !== 'resize') return;
    const keptId = first.action.noteId;
    applyNoteOperations(ctx, ops);
    const mi = sel?.type === 'note' ? sel.measureIndex : undefined;
    if (mi !== undefined) ctx.onSelectionChange(selectionAfterTie(keptId, mi));
    return;
  }

  if (id === 'toggleTriplet') {
    const ops = planTripletToggle(song, sel);
    if (!ops?.length) return;
    applyNoteOperations(ctx, ops);
  }
}

/**
 * Diatonic chord digit path shared with the left-panel chord palette (TASK-5.1).
 * Mutates `textDurationArmedRef` on text-mode paths the same way digit keys do.
 * @returns true if a chord edit was applied (keyboard layer should `preventDefault`).
 */
export function applyChordScaleDegreeFromEditor(ctx: EditorKeyboardContext, degree: ScaleDegree): boolean {
  const selection = pickSelection(ctx);
  if (selection?.type === 'range') {
    const isCollapsedCaret = selection.rangeStart === selection.rangeEnd && ctx.entryMode === 'table';
    if (!isCollapsedCaret) return false;
  }

  if (ctx.entryMode === 'text' && !ctx.textDurationArmedRef.current) return false;

  const measureIndex = resolveMeasureIndexForKeyboardDigit(
    selection,
    ctx.viewport,
    pickSong(ctx),
    ctx.keyboardTargetMeasureRef,
  );

  const noteEntry = shouldUseNoteEntry(selection);
  const chordDigitsOk = shouldAllowChordDigitEntry(ctx.entryMode) && !noteEntry;
  if (!chordDigitsOk) return false;

  if (ctx.entryMode === 'text') {
    if (selection?.type === 'chord' && selection.eventIds?.[0]) {
      const id = selection.eventIds[0];
      const ch = ctx.song.measures[selection.measureIndex]?.chords.find((c) => c.id === id);
      if (!ch) return false;
      ctx.textDurationArmedRef.current = false;
      const durClamped = clampDurationToMeasure(ctx.song, selection.measureIndex, ch.beat, ctx.currentDurationTicks);
      const p = buildDiatonicChordPayload(ctx.song, selection.measureIndex, degree, ch.beat, durClamped);
      ctx.onChordEdit(selection.measureIndex, {
        type: 'update',
        chordId: id,
        changes: {
          scaleDegree: p.scaleDegree,
          quality: p.quality,
          seventh: p.seventh,
          suspension: p.suspension,
          addition: p.addition,
          inversion: p.inversion,
          borrowed: p.borrowed,
          secondary: p.secondary,
          duration: durClamped,
        },
      });
      return true;
    }
    const nb = tableInsertBeatFromSelection(selection, ctx.song, measureIndex, 'chord', ctx.activeVoice);
    if (nb == null) return false;
    ctx.textDurationArmedRef.current = false;
    const durClamped = clampDurationToMeasure(ctx.song, measureIndex, nb, ctx.currentDurationTicks);
    const payload = buildDiatonicChordPayload(ctx.song, measureIndex, degree, nb, durClamped);
    ctx.onChordEdit(measureIndex, { type: 'add', chord: payload });
    return true;
  }

  const songForChord = pickSong(ctx);
  const nb = tableInsertBeatFromSelection(selection, songForChord, measureIndex, 'chord', ctx.activeVoice);
  if (nb == null) return false;
  const durClamped = clampDurationToMeasure(songForChord, measureIndex, nb, ctx.currentDurationTicks);
  const payload = buildDiatonicChordPayload(songForChord, measureIndex, degree, nb, durClamped);
  ctx.onChordEdit(measureIndex, { type: 'add', chord: payload });

  const songAfter = pickSong(ctx);
  if (entryEndsAtOrPastMeasureEnd(songAfter, measureIndex, nb, durClamped) && measureIndex + 1 < songAfter.measures.length) {
    ctx.keyboardTargetMeasureRef.current = measureIndex + 1;
    ctx.onSelectionChange(null);
  } else {
    ctx.onSelectionChange(tableModeAdvanceRange(songAfter, measureIndex, nb, durClamped));
  }
  return true;
}

/**
 * TASK-5.2 — Chord palette path for diatonic **or** borrowed payloads: same placement rules as
 * {@link applyChordScaleDegreeFromEditor}, but chord theory fields come from the palette (`borrowed`,
 * quality, seventh, etc.) instead of {@link buildDiatonicChordPayload}.
 */
export function applyChordPalettePayloadFromEditor(
  ctx: EditorKeyboardContext,
  fields: Omit<ChordEvent, 'id' | 'beat' | 'duration'>,
): boolean {
  const selection = pickSelection(ctx);
  if (selection?.type === 'range') {
    const isCollapsedCaret = selection.rangeStart === selection.rangeEnd && ctx.entryMode === 'table';
    if (!isCollapsedCaret) return false;
  }

  if (ctx.entryMode === 'text' && !ctx.textDurationArmedRef.current) return false;

  const measureIndex = resolveMeasureIndexForKeyboardDigit(
    selection,
    ctx.viewport,
    pickSong(ctx),
    ctx.keyboardTargetMeasureRef,
  );

  const noteEntry = shouldUseNoteEntry(selection);
  const chordDigitsOk = shouldAllowChordDigitEntry(ctx.entryMode) && !noteEntry;
  if (!chordDigitsOk) return false;

  if (ctx.entryMode === 'text') {
    if (selection?.type === 'chord' && selection.eventIds?.[0]) {
      const id = selection.eventIds[0];
      const ch = ctx.song.measures[selection.measureIndex]?.chords.find((c) => c.id === id);
      if (!ch) return false;
      ctx.textDurationArmedRef.current = false;
      const durClamped = clampDurationToMeasure(ctx.song, selection.measureIndex, ch.beat, ctx.currentDurationTicks);
      ctx.onChordEdit(selection.measureIndex, {
        type: 'update',
        chordId: id,
        changes: {
          scaleDegree: fields.scaleDegree,
          quality: fields.quality,
          seventh: fields.seventh,
          suspension: fields.suspension,
          addition: fields.addition,
          inversion: fields.inversion,
          borrowed: fields.borrowed,
          secondary: fields.secondary,
          duration: durClamped,
        },
      });
      return true;
    }
    const nb = tableInsertBeatFromSelection(selection, ctx.song, measureIndex, 'chord', ctx.activeVoice);
    if (nb == null) return false;
    ctx.textDurationArmedRef.current = false;
    const durClamped = clampDurationToMeasure(ctx.song, measureIndex, nb, ctx.currentDurationTicks);
    const payload: Omit<ChordEvent, 'id'> = { ...fields, beat: nb, duration: durClamped };
    ctx.onChordEdit(measureIndex, { type: 'add', chord: payload });
    return true;
  }

  const songForChord = pickSong(ctx);
  const nb = tableInsertBeatFromSelection(selection, songForChord, measureIndex, 'chord', ctx.activeVoice);
  if (nb == null) return false;
  const durClamped = clampDurationToMeasure(songForChord, measureIndex, nb, ctx.currentDurationTicks);
  const payload: Omit<ChordEvent, 'id'> = { ...fields, beat: nb, duration: durClamped };
  ctx.onChordEdit(measureIndex, { type: 'add', chord: payload });

  const songAfter = pickSong(ctx);
  if (entryEndsAtOrPastMeasureEnd(songAfter, measureIndex, nb, durClamped) && measureIndex + 1 < songAfter.measures.length) {
    ctx.keyboardTargetMeasureRef.current = measureIndex + 1;
    ctx.onSelectionChange(null);
  } else {
    ctx.onSelectionChange(tableModeAdvanceRange(songAfter, measureIndex, nb, durClamped));
  }
  return true;
}

/**
 * Left-panel melody pitch buttons (UI-W3) — same placement/selection advancement rules as digit keys in
 * {@link handleEditorKeydown} when `shouldUseNoteEntry` is true, plus collapsed table caret (`range`) inserts at the caret beat.
 */
export function applyMelodyPitchDegreeFromEditor(ctx: EditorKeyboardContext, degree: ScaleDegree): boolean {
  const selection = pickSelection(ctx);
  if (selection?.type === 'range') {
    const isCollapsedCaret = selection.rangeStart === selection.rangeEnd && ctx.entryMode === 'table';
    if (!isCollapsedCaret) return false;
  }

  if (ctx.entryMode === 'text' && !ctx.textDurationArmedRef.current) return false;

  const measureIndex = resolveMeasureIndexForKeyboardDigit(
    selection,
    ctx.viewport,
    pickSong(ctx),
    ctx.keyboardTargetMeasureRef,
  );

  const selNoteId = selection?.type === 'note' ? selection.eventIds?.[0] : undefined;
  const song = pickSong(ctx);
  const voice =
    selNoteId != null ? (findVoiceForNote(song, measureIndex, selNoteId) ?? ctx.activeVoice) : ctx.activeVoice;

  if (ctx.entryMode === 'text') {
    if (!selNoteId) return false;
    const note = song.measures[measureIndex]?.notes[voice]?.find((n) => n.id === selNoteId);
    if (!note) return false;
    ctx.textDurationArmedRef.current = false;
    const durClamped = clampDurationToMeasure(song, measureIndex, note.beat, ctx.currentDurationTicks);
    const chrom = melodyDefaultChromaticOffset(ctx);
    const nextChromatic = chrom === 1 ? 1 : note.chromatic;
    const octave =
      ctx.smartOctaveEnabled === true
        ? pickSmartOctaveForDegreeEdit(song, measureIndex, degree, nextChromatic, note)
        : note.octave;
    ctx.onNoteEdit(measureIndex, voice, {
      type: 'update',
      noteId: selNoteId,
      changes: {
        scaleDegree: degree,
        duration: durClamped,
        isRest: false,
        ...(ctx.smartOctaveEnabled === true ? { octave } : {}),
        ...(chrom === 1 ? { chromatic: 1 } : {}),
      },
    });
    return true;
  }

  const nb = tableInsertBeatFromSelection(selection, song, measureIndex, 'note', voice);
  if (nb == null) return false;
  const durClamped = clampDurationToMeasure(song, measureIndex, nb, ctx.currentDurationTicks);
  const chrom = melodyDefaultChromaticOffset(ctx);
  const smartOct =
    ctx.smartOctaveEnabled === true
      ? pickSmartOctaveForNewNote(song, measureIndex, voice, nb, degree, chrom)
      : 0;
  const payload = {
    ...buildDefaultNotePayload(song, measureIndex, degree, nb, durClamped),
    chromatic: chrom,
    octave: smartOct,
  };
  ctx.onNoteEdit(measureIndex, voice, { type: 'add', note: payload });

  const songAfter = pickSong(ctx);
  const m = songAfter.measures[measureIndex];
  const nid = m ? findNoteIdByPlacement(m.notes[voice], nb, degree, durClamped) : null;
  if (ctx.getSongAfterMutation && nid) {
    if (entryEndsAtOrPastMeasureEnd(songAfter, measureIndex, nb, durClamped) && measureIndex + 1 < songAfter.measures.length) {
      ctx.keyboardTargetMeasureRef.current = measureIndex + 1;
      ctx.onSelectionChange(null);
    } else {
      ctx.onSelectionChange({ type: 'note', measureIndex, eventIds: [nid] });
    }
  } else {
    ctx.onSelectionChange(tableModeAdvanceRange(pickSong(ctx), measureIndex, nb, durClamped));
  }
  return true;
}

/**
 * Left-panel rest — inserts at table caret or appends in the active voice (same beat rules as melody pitch).
 */
export function applyMelodyRestFromEditor(ctx: EditorKeyboardContext): boolean {
  const selection = pickSelection(ctx);
  if (selection?.type === 'range') {
    const isCollapsedCaret = selection.rangeStart === selection.rangeEnd && ctx.entryMode === 'table';
    if (!isCollapsedCaret) return false;
  }

  if (ctx.entryMode === 'text' && !ctx.textDurationArmedRef.current) return false;

  const measureIndex = resolveMeasureIndexForKeyboardDigit(
    selection,
    ctx.viewport,
    pickSong(ctx),
    ctx.keyboardTargetMeasureRef,
  );

  const selNoteId = selection?.type === 'note' ? selection.eventIds?.[0] : undefined;
  const song = pickSong(ctx);
  const voice =
    selNoteId != null ? (findVoiceForNote(song, measureIndex, selNoteId) ?? ctx.activeVoice) : ctx.activeVoice;

  if (ctx.entryMode === 'text') {
    if (!selNoteId) return false;
    const note = song.measures[measureIndex]?.notes[voice]?.find((n) => n.id === selNoteId);
    if (!note) return false;
    ctx.textDurationArmedRef.current = false;
    const durClamped = clampDurationToMeasure(song, measureIndex, note.beat, ctx.currentDurationTicks);
    ctx.onNoteEdit(measureIndex, voice, {
      type: 'update',
      noteId: selNoteId,
      changes: {
        isRest: true,
        duration: durClamped,
      },
    });
    return true;
  }

  const nb = tableInsertBeatFromSelection(selection, song, measureIndex, 'note', voice);
  if (nb == null) return false;
  const durClamped = clampDurationToMeasure(song, measureIndex, nb, ctx.currentDurationTicks);
  const payload = buildRestNotePayload(nb, durClamped);
  ctx.onNoteEdit(measureIndex, voice, { type: 'add', note: payload });

  const songAfter = pickSong(ctx);
  const m = songAfter.measures[measureIndex];
  let nid: string | null = null;
  if (m) {
    const lane = m.notes[voice];
    for (let i = lane.length - 1; i >= 0; i--) {
      const n = lane[i];
      if (n && n.beat === nb && n.duration === durClamped && n.isRest) {
        nid = n.id;
        break;
      }
    }
  }
  if (ctx.getSongAfterMutation && nid) {
    if (entryEndsAtOrPastMeasureEnd(songAfter, measureIndex, nb, durClamped) && measureIndex + 1 < songAfter.measures.length) {
      ctx.keyboardTargetMeasureRef.current = measureIndex + 1;
      ctx.onSelectionChange(null);
    } else {
      ctx.onSelectionChange({ type: 'note', measureIndex, eventIds: [nid] });
    }
  } else {
    ctx.onSelectionChange(tableModeAdvanceRange(pickSong(ctx), measureIndex, nb, durClamped));
  }
  return true;
}

type SelectedMelodyNoteState = {
  noteId: string;
  note: NoteEvent;
  measureIndex: number;
  voice: 0 | 1 | 2 | 3;
};

function pickSelectedMelodyNote(ctx: EditorKeyboardContext): SelectedMelodyNoteState | null {
  const sel = pickSelection(ctx);
  if (sel?.type !== 'note' || !sel.eventIds?.[0]) return null;

  const song = pickSong(ctx);
  const measureIndex = sel.measureIndex;
  const noteId = sel.eventIds[0];
  const voice = findVoiceForNote(song, measureIndex, noteId);
  if (voice == null) return null;
  const note = song.measures[measureIndex]?.notes[voice].find((n) => n.id === noteId);
  if (!note) return null;

  return { noteId, note, measureIndex, voice };
}

function applyDiatonicStep(degree: ScaleDegree, delta: -1 | 1): { degree: ScaleDegree; octaveDelta: number } {
  const up: Record<ScaleDegree, ScaleDegree> = {
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 6,
    6: 7,
    7: 1,
  };
  const down: Record<ScaleDegree, ScaleDegree> = {
    1: 7,
    2: 1,
    3: 2,
    4: 3,
    5: 4,
    6: 5,
    7: 6,
  };

  if (delta === 1) {
    return { degree: up[degree], octaveDelta: degree === 7 ? 1 : 0 };
  }
  return { degree: down[degree], octaveDelta: degree === 1 ? -1 : 0 };
}

/** Half-step chromatic nudge on a selected note (PAT-018); used by left-panel Raise/Lower (UI-W3). */
export function applyMelodyChromaticNudgeFromEditor(ctx: EditorKeyboardContext, delta: -1 | 1): boolean {
  const sel = pickSelectedMelodyNote(ctx);
  if (!sel || sel.note.isRest) return false;
  const note = sel.note;
  const next = note.chromatic + delta;
  ctx.onNoteEdit(sel.measureIndex, sel.voice, { type: 'update', noteId: sel.noteId, changes: { chromatic: next } });
  return true;
}

/**
 * Diatonic (scale-degree) nudge on a selected note.
 * A wrap from degree 7 to 1 raises by one octave, and from 1 to 7 lowers by one octave.
 */
export function applyMelodyDegreeNudgeFromEditor(ctx: EditorKeyboardContext, delta: -1 | 1): boolean {
  const sel = pickSelectedMelodyNote(ctx);
  if (!sel || sel.note.isRest) return false;
  const next = applyDiatonicStep(sel.note.scaleDegree, delta);
  ctx.onNoteEdit(sel.measureIndex, sel.voice, {
    type: 'update',
    noteId: sel.noteId,
    changes: {
      scaleDegree: next.degree,
      ...(next.octaveDelta !== 0 ? { octave: sel.note.octave + next.octaveDelta } : {}),
    },
  });
  return true;
}

/** Octave nudge on a selected note. */
export function applyMelodyOctaveNudgeFromEditor(ctx: EditorKeyboardContext, delta: -1 | 1): boolean {
  const sel = pickSelectedMelodyNote(ctx);
  if (!sel || sel.note.isRest) return false;
  ctx.onNoteEdit(sel.measureIndex, sel.voice, {
    type: 'update',
    noteId: sel.noteId,
    changes: { octave: sel.note.octave + delta },
  });
  return true;
}

/**
 * Add a note (duplicate of selected note degree/octave/chromatic) or a rest when selection is non-note.
 * Used by left-panel ADD control; follows table-mode insertion rules for table-mode workflows.
 */
export function applyMelodyAddFromEditor(ctx: EditorKeyboardContext): boolean {
  const selection = pickSelection(ctx);
  if (selection?.type === 'range') {
    const isCollapsedCaret = selection.rangeStart === selection.rangeEnd && ctx.entryMode === 'table';
    if (!isCollapsedCaret) return false;
  }

  const song = pickSong(ctx);
  const measureIndex = resolveMeasureIndexForKeyboardDigit(
    selection,
    ctx.viewport,
    song,
    ctx.keyboardTargetMeasureRef,
  );
  const selectedNoteId = selection?.type === 'note' ? selection.eventIds?.[0] : undefined;
  let sourceVoice = ctx.activeVoice;
  let sourceNote: NoteEvent | null = null;

  if (selectedNoteId != null) {
    const noteVoice = findVoiceForNote(song, measureIndex, selectedNoteId);
    sourceVoice = noteVoice ?? ctx.activeVoice;
    sourceNote =
      song.measures[measureIndex]?.notes[sourceVoice]?.find((n) => n.id === selectedNoteId) ?? null;
  }

  const nb = tableInsertBeatFromSelection(selection, song, measureIndex, 'note', sourceVoice);
  if (nb == null) return false;
  const durClamped = clampDurationToMeasure(song, measureIndex, nb, ctx.currentDurationTicks);

  if (sourceNote != null && !sourceNote.isRest) {
    const payload = {
      ...buildDefaultNotePayload(song, measureIndex, sourceNote.scaleDegree, nb, durClamped),
      chromatic: sourceNote.chromatic,
      octave: sourceNote.octave,
    };
    ctx.onNoteEdit(measureIndex, sourceVoice, { type: 'add', note: payload });
  } else {
    const payload = buildRestNotePayload(nb, durClamped);
    ctx.onNoteEdit(measureIndex, sourceVoice, { type: 'add', note: payload });
  }

  const songAfter = pickSong(ctx);
  const lane = songAfter.measures[measureIndex]?.notes[sourceVoice];
  const isRestInsert = sourceNote == null || sourceNote.isRest;
  let insertedId: string | null = null;

  if (lane) {
    if (!isRestInsert && sourceNote != null) {
      insertedId = findNoteIdByPlacement(lane, nb, sourceNote.scaleDegree, durClamped);
    } else {
      for (let i = lane.length - 1; i >= 0; i--) {
        const n = lane[i];
        if (!n) continue;
        if (n.beat === nb && n.duration === durClamped && n.isRest) {
          insertedId = n.id;
          break;
        }
      }
    }
  }

  if (ctx.getSongAfterMutation && insertedId) {
    if (entryEndsAtOrPastMeasureEnd(songAfter, measureIndex, nb, durClamped) && measureIndex + 1 < songAfter.measures.length) {
      ctx.keyboardTargetMeasureRef.current = measureIndex + 1;
      ctx.onSelectionChange(null);
    } else {
      ctx.onSelectionChange({ type: 'note', measureIndex, eventIds: [insertedId] });
    }
  } else {
    ctx.onSelectionChange(tableModeAdvanceRange(songAfter, measureIndex, nb, durClamped));
  }
  return true;
}

/**
 * TASK-2.8 grid editor key handling — exported for unit tests.
 * Window capture listener; skips editable targets (inputs) per UX §8.
 */
export function handleEditorKeydown(e: KeyboardEvent, ctx: EditorKeyboardContext): void {
  if (e.defaultPrevented) return;
  if (isEditableKeyboardTarget(document.activeElement)) return;
  if (isEditableKeyboardTarget(e.target)) return;

  // TASK-5.7 — melody voice (use e.code so Shift+digit does not map to punctuation on some layouts).
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    const code = e.code;
    if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3' || code === 'Digit4') {
      e.preventDefault();
      const digit = Number(code.replace('Digit', ''));
      ctx.setActiveVoice((digit - 1) as 0 | 1 | 2 | 3);
      return;
    }
  }

  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const selection = pickSelection(ctx);
  const key = e.key;

  const toggleEntryMode = ctx.onToggleEntryMode ?? ctx.onEntryModeToggle;
  if (key === 'Tab' && toggleEntryMode && !isEditableKeyboardTarget(e.target ?? null)) {
    e.preventDefault();
    toggleEntryMode();
    return;
  }

  // TASK-5.3 — cycle V/x · viio/x · IV/x applied slots (see getSecondaryCycleSequence); same as palette "Cycle".
  if (key === 'd' || key === 'D') {
    const sel = pickSelection(ctx);
    const chordId = sel?.type === 'chord' ? sel.eventIds?.[0] : undefined;
    if (!chordId || sel?.type !== 'chord') return;
    const song = pickSong(ctx);
    const ch = song.measures[sel.measureIndex]?.chords.find((c) => c.id === chordId);
    if (!ch) return;
    e.preventDefault();
    const homeKey = getKeyAtMeasure(song, sel.measureIndex);
    const homeScale = getScaleAtMeasure(song, sel.measureIndex);
    const changes = cycleSecondaryChordEdit(ch, homeKey, homeScale);
    if (Object.keys(changes).length === 0) return;
    ctx.onChordEdit(sel.measureIndex, { type: 'update', chordId, changes });
    return;
  }

  // TASK-7.5: When the canvas has editor focus, `moveSelectionLeft`/`moveSelectionRight` are handled by PAT-027 first
  // (same `navigateSelection` behavior). This path runs when the registry did not consume the event (e.g. no canvas focus).
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const dir = key === 'ArrowLeft' ? -1 : 1;
    const next = navigateSelection(ctx.song, ctx.viewport, selection, ctx.activeVoice, dir, ctx.entryMode);
    if (next) {
      e.preventDefault();
      ctx.onSelectionChange(next);
    }
    return;
  }

  if (key === 'Backspace' || key === 'Delete') {
    const sel = selection;
    const id = sel?.eventIds?.[0];
    if (!sel || !id || sel.type === 'range') return;
    e.preventDefault();
    if (sel.type === 'chord') {
      ctx.onChordEdit(sel.measureIndex, { type: 'delete', chordId: id });
    } else {
      const voice = findVoiceForNote(ctx.song, sel.measureIndex, id);
      if (voice != null) ctx.onNoteEdit(sel.measureIndex, voice, { type: 'delete', noteId: id });
    }
    ctx.onSelectionChange(null);
    return;
  }

  /** TASK-5.4 / UX §8: `i` = cycle inversion; `e` = cycle embellishments (seventh → sus → add per INTERFACES.md) on one chord only. */
  const keyNorm = key.length === 1 ? key.toLowerCase() : '';
  if (
    selection?.type === 'chord' &&
    Array.isArray(selection.eventIds) &&
    selection.eventIds.length === 1 &&
    (keyNorm === 'i' || keyNorm === 'e')
  ) {
    const chordId = selection.eventIds[0];
    const measureIndex = selection.measureIndex;
    const song = pickSong(ctx);
    const chord = song.measures[measureIndex]?.chords.find((c) => c.id === chordId);
    if (chord) {
      e.preventDefault();
      if (keyNorm === 'i') {
        const nextInv = nextCycledInversion(chord);
        if (nextInv !== chord.inversion) {
          ctx.onChordEdit(measureIndex, { type: 'update', chordId, changes: { inversion: nextInv } });
        }
      } else {
        const nextEm = nextCycledEmbellishment(chord);
        if (
          nextEm.seventh !== chord.seventh ||
          nextEm.suspension !== chord.suspension ||
          nextEm.addition !== chord.addition
        ) {
          ctx.onChordEdit(measureIndex, { type: 'update', chordId, changes: nextEm });
        }
      }
    }
    return;
  }

  const dur =
    DURATION_KEYS[key] ??
    (key.length === 1 && /[a-zA-Z]/.test(key) ? DURATION_KEYS[key.toLowerCase()] : undefined);
  if (dur !== undefined) {
    // When the shell wires PAT-027 `shortcutManager`, primary-row duration is dispatched by command id only
    // (avoids double-firing with `handleKeyDown`); alternate row q w e r t still uses this path.
    if (isRegistryOwnedDurationKey(key, ctx.shortcutManager)) {
      return;
    }
    if (isEditorShortcutContextBlockingDuration(ctx)) {
      return;
    }
    e.preventDefault();
    applyDurationTicksFromEditor(ctx, dur);
    return;
  }

  const degree = parseScaleDegreeKey(key);
  if (degree != null) {
    const sel = selection;
    if (sel?.type === 'range') {
      const isCollapsedCaret = sel.rangeStart === sel.rangeEnd && ctx.entryMode === 'table';
      if (!isCollapsedCaret) return;
    }

    if (ctx.entryMode === 'text' && !ctx.textDurationArmedRef.current) return;

    const measureIndex = resolveMeasureIndexForKeyboardDigit(
      selection,
      ctx.viewport,
      pickSong(ctx),
      ctx.keyboardTargetMeasureRef,
    );

    const noteEntry = shouldUseNoteEntry(selection);
    const chordDigitsOk = shouldAllowChordDigitEntry(ctx.entryMode) && !noteEntry;

    if (noteEntry) {
      const selNoteId = selection?.type === 'note' ? selection.eventIds?.[0] : undefined;
      const voice =
        selNoteId != null ? (findVoiceForNote(ctx.song, measureIndex, selNoteId) ?? ctx.activeVoice) : ctx.activeVoice;

      if (ctx.entryMode === 'text') {
        if (!selNoteId) return;
        const note = ctx.song.measures[measureIndex]?.notes[voice]?.find((n) => n.id === selNoteId);
        if (!note) return;
        e.preventDefault();
        ctx.textDurationArmedRef.current = false;
        const durClamped = clampDurationToMeasure(ctx.song, measureIndex, note.beat, ctx.currentDurationTicks);
        const chrom = melodyDefaultChromaticOffset(ctx);
        const nextChromatic = chrom === 1 ? 1 : note.chromatic;
        const octave =
          ctx.smartOctaveEnabled === true
            ? pickSmartOctaveForDegreeEdit(ctx.song, measureIndex, degree, nextChromatic, note)
            : note.octave;
        ctx.onNoteEdit(measureIndex, voice, {
          type: 'update',
          noteId: selNoteId,
          changes: {
            scaleDegree: degree,
            duration: durClamped,
            isRest: false,
            ...(ctx.smartOctaveEnabled === true ? { octave } : {}),
            ...(chrom === 1 ? { chromatic: 1 } : {}),
          },
        });
        return;
      }

      const nb = tableInsertBeatFromSelection(selection, ctx.song, measureIndex, 'note', voice);
      if (nb == null) return;
      e.preventDefault();
      const durClamped = clampDurationToMeasure(ctx.song, measureIndex, nb, ctx.currentDurationTicks);
      const chrom = melodyDefaultChromaticOffset(ctx);
      const smartOct =
        ctx.smartOctaveEnabled === true
          ? pickSmartOctaveForNewNote(ctx.song, measureIndex, voice, nb, degree, chrom)
          : 0;
      const payload = {
        ...buildDefaultNotePayload(ctx.song, measureIndex, degree, nb, durClamped),
        chromatic: chrom,
        octave: smartOct,
      };
      ctx.onNoteEdit(measureIndex, voice, { type: 'add', note: payload });

      const songAfter = pickSong(ctx);
      const m = songAfter.measures[measureIndex];
      const nid = m ? findNoteIdByPlacement(m.notes[voice], nb, degree, durClamped) : null;
      if (ctx.getSongAfterMutation && nid) {
        if (entryEndsAtOrPastMeasureEnd(songAfter, measureIndex, nb, durClamped) && measureIndex + 1 < songAfter.measures.length) {
          ctx.keyboardTargetMeasureRef.current = measureIndex + 1;
          ctx.onSelectionChange(null);
        } else {
          ctx.onSelectionChange({ type: 'note', measureIndex, eventIds: [nid] });
        }
      } else {
        ctx.onSelectionChange(tableModeAdvanceRange(ctx.song, measureIndex, nb, durClamped));
      }
      return;
    }

    if (chordDigitsOk) {
      const did = applyChordScaleDegreeFromEditor(ctx, degree);
      if (did) e.preventDefault();
    }
  }
}

export function useKeyboard(ctx: EditorKeyboardContext): void {
  const ref = useRef(ctx);
  ref.current = ctx;

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.defaultPrevented) return;
      const current = ref.current;
      const mgr = current.shortcutManager;
      const shortcutCtx = current.getShortcutContext;
      if (mgr && shortcutCtx) {
        if (mgr.handleKeyDown(e, shortcutCtx())) {
          return;
        }
      }
      handleEditorKeydown(e, current);
    };
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, []);
}
