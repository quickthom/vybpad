import type { ChordEditAction, NoteEditAction, ScaleDegree, Selection, SongData, Viewport } from '@vybpad/shared';
import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';

import {
  buildDefaultNotePayload,
  buildDiatonicChordPayload,
  clampDurationToMeasure,
  DURATION_KEYS,
  entryEndsAtOrPastMeasureEnd,
  findChordIdByPlacement,
  findNoteIdByPlacement,
  isEditableKeyboardTarget,
  navigateSelection,
  nextAppendBeat,
  resolveMeasureIndexForKeyboardDigit,
  shouldAllowChordDigitEntry,
  shouldUseNoteEntry,
  tableModeAdvanceRange,
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
  /** When table-mode advance crosses a barline, next digit resolves to the following measure. */
  keyboardTargetMeasureRef: MutableRefObject<number | null>;
  textDurationArmedRef: MutableRefObject<boolean>;
  /** After editChord/editNote, read authoritative song (App wires Zustand). Tests simulate with mocks. */
  getSongAfterMutation?: () => SongData;
  onToggleEntryMode?: () => void;
  onEntryModeToggle?: () => void;
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

function pickSong(ctx: EditorKeyboardContext): SongData {
  return ctx.getSongAfterMutation?.() ?? ctx.song;
}

/** Collapsed range in table mode acts as a caret beat for the next insertion (TASK-2.9). */
function tableInsertBeatFromSelection(
  selection: Selection | null,
  song: SongData,
  measureIndex: number,
  kind: 'chord' | 'note',
  voice: 0 | 1 | 2 | 3,
): number | null {
  if (
    selection?.type === 'range' &&
    selection.rangeStart === selection.rangeEnd &&
    selection.measureIndex === measureIndex
  ) {
    return Math.round(selection.rangeStart ?? 0);
  }
  return nextAppendBeat(song, measureIndex, kind, voice);
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

  const applyDurationKey = (ticks: number): void => {
    const rounded = Math.round(ticks);
    ctx.setCurrentDurationTicks(rounded);
    if (ctx.entryMode === 'text') {
      ctx.textDurationArmedRef.current = true;
      return;
    }
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

  const toggleEntryMode = ctx.onToggleEntryMode ?? ctx.onEntryModeToggle;
  if (key === 'Tab' && toggleEntryMode && !isEditableKeyboardTarget(e.target ?? null)) {
    e.preventDefault();
    toggleEntryMode();
    return;
  }

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
    const sel = ctx.selection;
    if (sel?.type === 'range') {
      const isCollapsedCaret = sel.rangeStart === sel.rangeEnd && ctx.entryMode === 'table';
      if (!isCollapsedCaret) return;
    }

    if (ctx.entryMode === 'text' && !ctx.textDurationArmedRef.current) return;

    const measureIndex = resolveMeasureIndexForKeyboardDigit(
      ctx.selection,
      ctx.viewport,
      ctx.song,
      ctx.keyboardTargetMeasureRef,
    );

    const noteEntry = shouldUseNoteEntry(ctx.selection);
    const chordDigitsOk = shouldAllowChordDigitEntry(ctx.entryMode) && !noteEntry;

    if (noteEntry) {
      const selNoteId = ctx.selection?.type === 'note' ? ctx.selection.eventIds?.[0] : undefined;
      const voice =
        selNoteId != null ? (findVoiceForNote(ctx.song, measureIndex, selNoteId) ?? ctx.activeVoice) : ctx.activeVoice;

      if (ctx.entryMode === 'text') {
        if (!selNoteId) return;
        const note = ctx.song.measures[measureIndex]?.notes[voice]?.find((n) => n.id === selNoteId);
        if (!note) return;
        e.preventDefault();
        ctx.textDurationArmedRef.current = false;
        const durClamped = clampDurationToMeasure(ctx.song, measureIndex, note.beat, ctx.currentDurationTicks);
        ctx.onNoteEdit(measureIndex, voice, {
          type: 'update',
          noteId: selNoteId,
          changes: { scaleDegree: degree, duration: durClamped, isRest: false },
        });
        return;
      }

      const nb = tableInsertBeatFromSelection(ctx.selection, ctx.song, measureIndex, 'note', voice);
      if (nb == null) return;
      e.preventDefault();
      const durClamped = clampDurationToMeasure(ctx.song, measureIndex, nb, ctx.currentDurationTicks);
      const payload = buildDefaultNotePayload(ctx.song, measureIndex, degree, nb, durClamped);
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
      if (ctx.entryMode === 'text') {
        if (ctx.selection?.type === 'chord' && ctx.selection.eventIds?.[0]) {
          const id = ctx.selection.eventIds[0];
          const ch = ctx.song.measures[ctx.selection.measureIndex]?.chords.find((c) => c.id === id);
          if (!ch) return;
          e.preventDefault();
          ctx.textDurationArmedRef.current = false;
          const durClamped = clampDurationToMeasure(ctx.song, ctx.selection.measureIndex, ch.beat, ctx.currentDurationTicks);
          const p = buildDiatonicChordPayload(ctx.song, ctx.selection.measureIndex, degree, ch.beat, durClamped);
          ctx.onChordEdit(ctx.selection.measureIndex, {
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
          return;
        }
        const nb = tableInsertBeatFromSelection(ctx.selection, ctx.song, measureIndex, 'chord', ctx.activeVoice);
        if (nb == null) return;
        e.preventDefault();
        ctx.textDurationArmedRef.current = false;
        const durClamped = clampDurationToMeasure(ctx.song, measureIndex, nb, ctx.currentDurationTicks);
        const payload = buildDiatonicChordPayload(ctx.song, measureIndex, degree, nb, durClamped);
        ctx.onChordEdit(measureIndex, { type: 'add', chord: payload });
        return;
      }

      const nb = tableInsertBeatFromSelection(ctx.selection, ctx.song, measureIndex, 'chord', ctx.activeVoice);
      if (nb == null) return;
      e.preventDefault();
      const durClamped = clampDurationToMeasure(ctx.song, measureIndex, nb, ctx.currentDurationTicks);
      const payload = buildDiatonicChordPayload(ctx.song, measureIndex, degree, nb, durClamped);
      ctx.onChordEdit(measureIndex, { type: 'add', chord: payload });

      const songAfter = pickSong(ctx);
      const m = songAfter.measures[measureIndex];
      const cid = m ? findChordIdByPlacement(m, nb, degree, durClamped) : null;
      if (ctx.getSongAfterMutation && cid) {
        if (entryEndsAtOrPastMeasureEnd(songAfter, measureIndex, nb, durClamped) && measureIndex + 1 < songAfter.measures.length) {
          ctx.keyboardTargetMeasureRef.current = measureIndex + 1;
          ctx.onSelectionChange(null);
        } else {
          ctx.onSelectionChange({ type: 'chord', measureIndex, eventIds: [cid] });
        }
      } else {
        ctx.onSelectionChange(tableModeAdvanceRange(ctx.song, measureIndex, nb, durClamped));
      }
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
