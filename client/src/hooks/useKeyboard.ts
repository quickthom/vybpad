import type { ChordEditAction, NoteEditAction, ScaleDegree, Selection, SongData, Viewport } from '@vybpad/shared';
import { useEffect, useRef } from 'react';

import {
  buildDefaultNotePayload,
  buildDiatonicChordPayload,
  clampDurationToMeasure,
  DURATION_KEYS,
  isEditableKeyboardTarget,
  navigateSelection,
  nextAppendBeat,
  resolveTargetMeasureIndex,
  shouldAllowChordDigitEntry,
  shouldUseNoteEntry,
} from '../components/editor/editorKeyboardLogic';

/** PAT-004 — re-export for unit tests (alias of DURATION_KEYS). */
export const DURATION_KEY_TICKS: Record<string, number> = DURATION_KEYS;

export interface EditorKeyboardContext {
  song: SongData;
  viewport: Viewport;
  selection: Selection | null;
  activeVoice: 0 | 1 | 2 | 3;
  entryMode: 'table' | 'text';
  currentDurationTicks: number;
  setCurrentDurationTicks: (n: number) => void;
  onChordEdit: (measureIndex: number, event: ChordEditAction) => void;
  onNoteEdit: (measureIndex: number, voice: number, event: NoteEditAction) => void;
  onSelectionChange: (selection: Selection | null) => void;
}

function parseScaleDegreeKey(key: string): ScaleDegree | null {
  if (key >= '1' && key <= '7') return Number(key) as ScaleDegree;
  return null;
}

function findVoiceForNote(song: SongData, measureIndex: number, noteId: string): 0 | 1 | 2 | 3 | null {
  const m = song.measures[measureIndex];
  if (!m) return null;
  for (const v of [0, 1, 2, 3] as const) {
    if (m.notes[v].some((n) => n.id === noteId)) return v;
  }
  return null;
}

/**
 * TASK-2.8 grid editor key handling — exported for unit tests.
 * Window capture listener; skips editable targets (inputs) per UX §8.
 */
export function handleEditorKeydown(e: KeyboardEvent, ctx: EditorKeyboardContext): void {
  if (e.defaultPrevented) return;
  if (isEditableKeyboardTarget(document.activeElement)) return;
  if (isEditableKeyboardTarget(e.target)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const measureIndex = resolveTargetMeasureIndex(ctx.selection, ctx.viewport, ctx.song);

  const applyDurationKey = (ticks: number): void => {
    const rounded = Math.round(ticks);
    ctx.setCurrentDurationTicks(rounded);
    const sel = ctx.selection;
    const id = sel?.eventIds?.[0];
    if (!id || !sel || sel.type === 'range') return;
    if (sel.type === 'chord') {
      const ch = ctx.song.measures[sel.measureIndex]?.chords.find((c) => c.id === id);
      if (!ch) return;
      const nd = clampDurationToMeasure(ctx.song, sel.measureIndex, ch.beat, rounded);
      if (nd !== ch.duration) ctx.onChordEdit(sel.measureIndex, { type: 'resize', chordId: id, newDuration: nd });
    } else if (sel.type === 'note') {
      const voice = findVoiceForNote(ctx.song, sel.measureIndex, id);
      if (voice == null) return;
      const note = ctx.song.measures[sel.measureIndex]?.notes[voice].find((n) => n.id === id);
      if (!note) return;
      const nd = clampDurationToMeasure(ctx.song, sel.measureIndex, note.beat, rounded);
      if (nd !== note.duration) ctx.onNoteEdit(sel.measureIndex, voice, { type: 'resize', noteId: id, newDuration: nd });
    }
  };

  const key = e.key;

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const dir = key === 'ArrowLeft' ? -1 : 1;
    const next = navigateSelection(ctx.song, ctx.viewport, ctx.selection, ctx.activeVoice, dir, ctx.entryMode);
    if (next) {
      e.preventDefault();
      ctx.onSelectionChange(next);
    }
    return;
  }

  if (key === 'Backspace' || key === 'Delete') {
    const sel = ctx.selection;
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

  const dur =
    DURATION_KEYS[key] ??
    (key.length === 1 && /[a-zA-Z]/.test(key) ? DURATION_KEYS[key.toLowerCase()] : undefined);
  if (dur !== undefined) {
    e.preventDefault();
    applyDurationKey(dur);
    return;
  }

  const degree = parseScaleDegreeKey(key);
  if (degree != null) {
    if (ctx.selection?.type === 'range') return;

    const noteEntry = shouldUseNoteEntry(ctx.selection);
    const chordDigitsOk = shouldAllowChordDigitEntry(ctx.entryMode);

    if (!noteEntry && !chordDigitsOk) return;

    if (noteEntry) {
      const selNoteId = ctx.selection?.type === 'note' ? ctx.selection.eventIds?.[0] : undefined;
      const voice =
        selNoteId != null ? (findVoiceForNote(ctx.song, measureIndex, selNoteId) ?? ctx.activeVoice) : ctx.activeVoice;
      const nb = nextAppendBeat(ctx.song, measureIndex, 'note', voice);
      if (nb == null) return;
      e.preventDefault();
      const durClamped = clampDurationToMeasure(ctx.song, measureIndex, nb, ctx.currentDurationTicks);
      const payload = buildDefaultNotePayload(ctx.song, measureIndex, degree, nb, durClamped);
      ctx.onNoteEdit(measureIndex, voice, { type: 'add', note: payload });
      return;
    }

    if (chordDigitsOk) {
      const nb = nextAppendBeat(ctx.song, measureIndex, 'chord', ctx.activeVoice);
      if (nb == null) return;
      e.preventDefault();
      const durClamped = clampDurationToMeasure(ctx.song, measureIndex, nb, ctx.currentDurationTicks);
      const payload = buildDiatonicChordPayload(ctx.song, measureIndex, degree, nb, durClamped);
      ctx.onChordEdit(measureIndex, { type: 'add', chord: payload });
    }
  }
}

export function useKeyboard(ctx: EditorKeyboardContext): void {
  const ref = useRef(ctx);
  ref.current = ctx;

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      handleEditorKeydown(e, ref.current);
    };
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, []);
}
