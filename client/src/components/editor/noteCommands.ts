/**
 * TASK-7.3 — Hookpad-style split / tie / triplet note operations (PAT-004 tick math).
 * Pure planners return batched {@link NoteEditAction}s for a single {@link useSongStore.getState().editNoteBatch} undo step.
 */

import type { NoteEditAction, NoteEvent, Selection, SongData } from '@vybpad/shared';

import { clampDurationToMeasure } from './editorKeyboardLogic';

export type NoteBatchOperation = {
  measureIndex: number;
  voice: 0 | 1 | 2 | 3;
  action: NoteEditAction;
};

export function findVoiceForNote(song: SongData, measureIndex: number, noteId: string): 0 | 1 | 2 | 3 | null {
  const m = song.measures[measureIndex];
  if (!m) return null;
  for (const v of [0, 1, 2, 3] as const) {
    if (m.notes[v].some((n) => n.id === noteId)) return v;
  }
  return null;
}

function samePitch(a: NoteEvent, b: NoteEvent): boolean {
  return (
    !a.isRest &&
    !b.isRest &&
    a.scaleDegree === b.scaleDegree &&
    a.octave === b.octave &&
    a.chromatic === b.chromatic
  );
}

/** PAT-004 straight ↔ triplet-class pairs (toggle restores the partner duration). */
const TRIPLET_DURATION_PAIR = new Map<number, number>([
  [96, 64],
  [64, 96],
  [48, 32],
  [32, 48],
  [24, 16],
  [16, 24],
]);

/**
 * Split the selected note at the **midpoint** of its duration (integer ticks).
 * ASSUMPTION (TASK-7.3): Hookpad-style split uses half of the note length; playhead-based split is not implemented.
 * Note-focused: chord or range selections yield `null` (no-op).
 */
export function planSplitNote(
  song: SongData,
  selection: Selection | null,
): NoteBatchOperation[] | null {
  if (!selection || selection.type !== 'note' || !selection.eventIds?.length) return null;
  const noteId = selection.eventIds[0];
  const measureIndex = selection.measureIndex;
  const voice = findVoiceForNote(song, measureIndex, noteId);
  if (voice == null) return null;
  const note = song.measures[measureIndex]?.notes[voice].find((n) => n.id === noteId);
  if (!note || note.isRest || note.duration < 2) return null;

  const splitBeat = note.beat + Math.floor(note.duration / 2);
  const d1 = splitBeat - note.beat;
  const d2 = note.beat + note.duration - splitBeat;
  if (d1 < 1 || d2 < 1) return null;

  const payload: Omit<NoteEvent, 'id'> = {
    scaleDegree: note.scaleDegree,
    octave: note.octave,
    chromatic: note.chromatic,
    beat: splitBeat,
    duration: d2,
    isRest: false,
    velocity: note.velocity,
  };

  return [
    { measureIndex, voice, action: { type: 'resize', noteId, newDuration: d1 } },
    { measureIndex, voice, action: { type: 'add', note: payload } },
  ];
}

/**
 * Tie merges **adjacent** same-pitch notes in the same voice (same measure only — NoteEvent is measure-local).
 * ASSUMPTION: two touches count as adjacent when `later.beat === earlier.beat + earlier.duration`.
 * If the **selected** note is the later note, we still merge into the earlier note and delete the selected one.
 */
export function planTieNote(song: SongData, selection: Selection | null): NoteBatchOperation[] | null {
  if (!selection || selection.type !== 'note' || !selection.eventIds?.length) return null;
  const measureIndex = selection.measureIndex;
  const ids = selection.eventIds;

  if (ids.length >= 2) {
    const idA = ids[0];
    const idB = ids[1];
    const voiceA = findVoiceForNote(song, measureIndex, idA);
    if (voiceA == null) return null;
    const lane = song.measures[measureIndex]?.notes[voiceA];
    if (!lane) return null;
    if (!lane.some((n) => n.id === idB)) return null;
    const nA = lane.find((n) => n.id === idA);
    const nB = lane.find((n) => n.id === idB);
    if (!nA || !nB) return null;
    const first = nA.beat <= nB.beat ? nA : nB;
    const second = nA.beat <= nB.beat ? nB : nA;
    if (samePitch(first, second) && second.beat === first.beat + first.duration) {
      return [
        {
          measureIndex,
          voice: voiceA,
          action: { type: 'resize', noteId: first.id, newDuration: first.duration + second.duration },
        },
        { measureIndex, voice: voiceA, action: { type: 'delete', noteId: second.id } },
      ];
    }
    return null;
  }

  const noteId = ids[0];
  const voice = findVoiceForNote(song, measureIndex, noteId);
  if (voice == null) return null;
  const lane = song.measures[measureIndex]?.notes[voice];
  if (!lane) return null;
  const sorted = [...lane].sort((a, b) => a.beat - b.beat);
  const idx = sorted.findIndex((n) => n.id === noteId);
  if (idx < 0) return null;
  const note = sorted[idx];
  if (!note) return null;

  const next = sorted[idx + 1];
  if (next && samePitch(note, next) && next.beat === note.beat + note.duration) {
    return [
      {
        measureIndex,
        voice,
        action: { type: 'resize', noteId: note.id, newDuration: note.duration + next.duration },
      },
      { measureIndex, voice, action: { type: 'delete', noteId: next.id } },
    ];
  }

  const prev = sorted[idx - 1];
  if (prev && samePitch(prev, note) && note.beat === prev.beat + prev.duration) {
    return [
      {
        measureIndex,
        voice,
        action: { type: 'resize', noteId: prev.id, newDuration: prev.duration + note.duration },
      },
      { measureIndex, voice, action: { type: 'delete', noteId: note.id } },
    ];
  }

  return null;
}

/**
 * Toggle between PAT-004 straight and triplet-class durations (16 / 32 / 64 ↔ 24 / 48 / 96).
 * ASSUMPTION: mappings are exactly the reciprocal pairs in {@link TRIPLET_DURATION_PAIR}; other durations no-op.
 */
export function planTripletToggle(
  song: SongData,
  selection: Selection | null,
): NoteBatchOperation[] | null {
  if (!selection || selection.type !== 'note' || !selection.eventIds?.length) return null;
  const noteId = selection.eventIds[0];
  const measureIndex = selection.measureIndex;
  const voice = findVoiceForNote(song, measureIndex, noteId);
  if (voice == null) return null;
  const note = song.measures[measureIndex]?.notes[voice].find((n) => n.id === noteId);
  if (!note || note.isRest) return null;

  const mapped = TRIPLET_DURATION_PAIR.get(note.duration);
  if (mapped === undefined) return null;
  const clamped = clampDurationToMeasure(song, measureIndex, note.beat, mapped);
  if (clamped === note.duration) return null;

  return [{ measureIndex, voice, action: { type: 'resize', noteId, newDuration: clamped } }];
}

/** After a split, select the second fragment (the note that starts at `splitBeat`). */
export function selectionAfterSplit(
  song: SongData,
  measureIndex: number,
  voice: 0 | 1 | 2 | 3,
  splitBeat: number,
  expectedDuration: number,
): Selection | null {
  const lane = song.measures[measureIndex]?.notes[voice];
  if (!lane) return null;
  const hit = lane.find((n) => n.beat === splitBeat && n.duration === expectedDuration);
  if (!hit) return null;
  return { type: 'note', measureIndex, eventIds: [hit.id] };
}

/** After tie forward (merged into first id) or backward (merged into prev id). */
export function selectionAfterTie(keptNoteId: string, measureIndex: number): Selection {
  return { type: 'note', measureIndex, eventIds: [keptNoteId] };
}

/** Resolve split beat/d2 for selection update (mirrors {@link planSplitNote}). */
export function splitMidpointParts(note: NoteEvent): { splitBeat: number; secondDuration: number } | null {
  if (note.isRest || note.duration < 2) return null;
  const splitBeat = note.beat + Math.floor(note.duration / 2);
  const d2 = note.beat + note.duration - splitBeat;
  if (splitBeat <= note.beat || d2 < 1) return null;
  return { splitBeat, secondDuration: d2 };
}
