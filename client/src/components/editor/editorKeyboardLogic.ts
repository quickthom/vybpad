import type { ChordEvent, Measure, NoteEvent, NoteName, ScaleDegree, ScaleType, Selection, SongData, Viewport } from '@vybpad/shared';

import { bottomChordStripTopY, viewportXToAbsoluteTick } from '../../engine/renderer/layout';
import { CHORD_AREA_HEIGHT, CHORD_LETTER_STRIP_HEIGHT, NOTE_HEIGHT } from '../../engine/renderer/constants';
import {
  getMeterAtMeasure,
  getScaleAtMeasure,
  measureIndexFromAbsoluteTick,
  measureLengthInTicks,
} from '../../engine/renderer/tickUtils';
import {
  chordEventFieldsForSecondary,
  chordRootPitchClassFromEvent,
  diatonicChordFieldsFromRootPitchClass,
  getSecondaryCycleSequence,
  theoryEngine,
} from '../../engine/theory';
import { getKeyScaleAtMeasure } from '../../engine/renderer/noteBlocks';
import { scaleDegreeToMidi } from '../../engine/theory/scaleDegreeToMidi';

/**
 * INTERFACES.md `ChordEvent` field order: seventh → suspension → addition.
 * TASK-5.4: one `e` key press advances one step; seventh types first (document union order), then sus, then add — mutually exclusive rows so `ChordEvent` stays coherent.
 */
const EMBELLISHMENT_CYCLE: ReadonlyArray<
  Pick<ChordEvent, 'seventh' | 'suspension' | 'addition'>
> = [
  { seventh: 'none', suspension: 'none', addition: 'none' },
  { seventh: 'maj7', suspension: 'none', addition: 'none' },
  { seventh: 'min7', suspension: 'none', addition: 'none' },
  { seventh: 'dom7', suspension: 'none', addition: 'none' },
  { seventh: 'dim7', suspension: 'none', addition: 'none' },
  { seventh: 'min7b5', suspension: 'none', addition: 'none' },
  { seventh: 'none', suspension: 'sus2', addition: 'none' },
  { seventh: 'none', suspension: 'sus4', addition: 'none' },
  { seventh: 'none', suspension: 'none', addition: 'add9' },
  { seventh: 'none', suspension: 'none', addition: 'add11' },
  { seventh: 'none', suspension: 'none', addition: 'add13' },
];

/** Next inversion for `i` (TASK-5.4); inversion 3 only when `seventh !== 'none'` per INTERFACES.md. */
export function nextCycledInversion(chord: ChordEvent): 0 | 1 | 2 | 3 {
  const hasSeventh = chord.seventh !== 'none';
  const max: 2 | 3 = hasSeventh ? 3 : 2;
  let inv = chord.inversion;
  if (inv > max) inv = max;
  if (inv === max) return 0;
  return (inv + 1) as 0 | 1 | 2 | 3;
}

/**
 * Next seventh/sus/add triple for `e` (TASK-5.4). Unknown combinations map like index 0 for advance → first embellished step.
 */
export function nextCycledEmbellishment(chord: ChordEvent): Pick<ChordEvent, 'seventh' | 'suspension' | 'addition'> {
  const idx = EMBELLISHMENT_CYCLE.findIndex(
    (s) => s.seventh === chord.seventh && s.suspension === chord.suspension && s.addition === chord.addition,
  );
  const i = idx >= 0 ? idx : 0;
  const nextIdx = (i + 1) % EMBELLISHMENT_CYCLE.length;
  return EMBELLISHMENT_CYCLE[nextIdx];
}

/**
 * PAT-004 durations. Primary row: h j k l ; ` and ' (32nd = 6 ticks) — TASK-7.2 / Hookpad parity.
 * q w e r t are alternate aliases so existing shortcuts/tests remain valid.
 * TASK-5.4: `e` on a **single selected chord** cycles embellishments instead (see handleEditorKeydown).
 */
export const DURATION_KEYS: Record<string, number> = {
  h: 192,
  j: 96,
  k: 48,
  l: 24,
  ';': 12,
  '`': 6,
  "'": 6,
  q: 192,
  w: 96,
  e: 48,
  r: 24,
  t: 12,
};

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function clampDurationToMeasure(song: SongData, measureIndex: number, beat: number, duration: number): number {
  const len = measureLengthInTicks(getMeterAtMeasure(song, measureIndex));
  const d = Math.round(duration);
  return Math.max(1, Math.min(d, len - beat));
}

export function resolveTargetMeasureIndex(selection: Selection | null, viewport: Viewport, song: SongData): number {
  const n = song.measures.length;
  if (n === 0) return 0;
  const raw = selection?.measureIndex ?? viewport.startMeasure;
  return Math.max(0, Math.min(raw, n - 1));
}

export { measureIndexFromAbsoluteTick } from '../../engine/renderer/tickUtils';

/** TASK-2.9 table mode: caret advances as a collapsed range at the next beat (PAT-004 tick math). */
export function tableModeAdvanceRange(
  song: SongData,
  measureIndex: number,
  beatStart: number,
  duration: number,
): Selection {
  const len = measureLengthInTicks(getMeterAtMeasure(song, measureIndex));
  const spanEnd = beatStart + duration;
  if (spanEnd >= len && measureIndex + 1 < song.measures.length) {
    return { type: 'range', measureIndex: measureIndex + 1, rangeStart: 0, rangeEnd: 0 };
  }
  return { type: 'range', measureIndex, rangeStart: spanEnd, rangeEnd: spanEnd };
}

export function entryEndsAtOrPastMeasureEnd(song: SongData, measureIndex: number, beat: number, duration: number): boolean {
  const len = measureLengthInTicks(getMeterAtMeasure(song, measureIndex));
  return beat + duration >= len;
}

export function findChordIdByPlacement(
  measure: Measure,
  beat: number,
  scaleDegree: ScaleDegree,
  duration: number,
): string | null {
  for (let i = measure.chords.length - 1; i >= 0; i--) {
    const c = measure.chords[i];
    if (c && c.beat === beat && c.scaleDegree === scaleDegree && c.duration === duration) return c.id;
  }
  return null;
}

export function findNoteIdByPlacement(
  lane: NoteEvent[],
  beat: number,
  scaleDegree: ScaleDegree,
  duration: number,
): string | null {
  for (let i = lane.length - 1; i >= 0; i--) {
    const n = lane[i];
    if (n && n.beat === beat && n.scaleDegree === scaleDegree && n.duration === duration) return n.id;
  }
  return null;
}

/**
 * After crossing a barline, the next digit targets the following measure — only digit entry consumes
 * this ref (not arrow navigation).
 */
export function resolveMeasureIndexForKeyboardDigit(
  selection: Selection | null,
  viewport: Viewport,
  song: SongData,
  keyboardTargetMeasureRef: { current: number | null },
): number {
  if (keyboardTargetMeasureRef.current != null) {
    const n = song.measures.length;
    if (n === 0) return 0;
    const raw = keyboardTargetMeasureRef.current;
    keyboardTargetMeasureRef.current = null;
    return Math.max(0, Math.min(raw, n - 1));
  }
  return resolveTargetMeasureIndex(selection, viewport, song);
}

export function nextAppendBeat(
  song: SongData,
  measureIndex: number,
  kind: 'chord' | 'note',
  voice: 0 | 1 | 2 | 3,
): number | null {
  const m = song.measures[measureIndex];
  if (!m) return null;
  const len = measureLengthInTicks(getMeterAtMeasure(song, measureIndex));
  let end = 0;
  if (kind === 'chord') {
    for (const c of m.chords) end = Math.max(end, c.beat + c.duration);
  } else {
    for (const n of m.notes[voice]) end = Math.max(end, n.beat + n.duration);
  }
  if (end >= len) return null;
  return end;
}

/**
 * When {@link hitTestEditorCanvas} misses (no chord/note block), a click in the **empty chord strip**
 * still needs a table-mode caret: collapsed `range` at the next chord append beat for the measure under X.
 * Otherwise pointer-down clears selection to `null` and digit keys that rely on a collapsed range / measure
 * context can fail to enter harmony (E2E persistence).
 */
export function chordStripCaretSelectionFromPointer(
  song: SongData,
  viewport: Viewport,
  viewportX: number,
  viewportY: number,
  melodyRowHeight: number = NOTE_HEIGHT,
): Selection | null {
  const stripTop = bottomChordStripTopY(melodyRowHeight);
  if (viewportY < stripTop || viewportY >= stripTop + CHORD_AREA_HEIGHT + CHORD_LETTER_STRIP_HEIGHT) {
    return null;
  }
  const absoluteTick = viewportXToAbsoluteTick(viewportX, viewport, song);
  const measureIndex = measureIndexFromAbsoluteTick(song, absoluteTick);
  const nb = nextAppendBeat(song, measureIndex, 'chord', 0);
  if (nb == null) {
    return null;
  }
  return { type: 'range', measureIndex, rangeStart: nb, rangeEnd: nb };
}

export function shouldUseNoteEntry(selection: Selection | null): boolean {
  return selection?.type === 'note';
}

/** Both modes accept chord digits; text mode requires a prior duration key (handled in useKeyboard). */
export function shouldAllowChordDigitEntry(_entryMode: 'table' | 'text'): boolean {
  void _entryMode; // reserved for future mode-specific rules
  return true;
}

/** Collapsed range in table mode acts as a caret beat for the next insertion (TASK-2.9). */
export function tableInsertBeatFromSelection(
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


/** TASK-5.3 — Remove applied chord metadata; spell the same root as diatonic in the home key. */
export function clearSecondaryChordEdit(
  chord: ChordEvent,
  homeKey: NoteName,
  homeScale: ScaleType,
): Partial<ChordEvent> {
  if (chord.secondary == null) {
    return {};
  }
  const rootPc = chordRootPitchClassFromEvent(chord, homeKey, homeScale);
  const d = diatonicChordFieldsFromRootPitchClass(rootPc, homeKey, homeScale);
  return {
    ...d,
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
  };
}

/**
 * TASK-5.3 — One step of the secondary applied-chord cycle (`d` key). See {@link getSecondaryCycleSequence}
 * for ordering. From diatonic (no secondary): applies the first legal slot; from the last slot: clears
 * `secondary` and restores diatonic spelling for the current root pitch class.
 */
export function cycleSecondaryChordEdit(
  chord: ChordEvent,
  homeKey: NoteName,
  homeScale: ScaleType,
): Partial<ChordEvent> {
  const seq = getSecondaryCycleSequence(homeScale);
  if (seq.length === 0) {
    return {};
  }

  if (chord.secondary == null) {
    return { ...chordEventFieldsForSecondary(seq[0]) };
  }

  const idx = seq.findIndex((s) => s.function === chord.secondary!.function && s.target === chord.secondary!.target);
  if (idx < 0) {
    return clearSecondaryChordEdit(chord, homeKey, homeScale);
  }
  if (idx >= seq.length - 1) {
    return clearSecondaryChordEdit(chord, homeKey, homeScale);
  }
  return { ...chordEventFieldsForSecondary(seq[idx + 1]) };
}

export function buildDiatonicChordPayload(
  song: SongData,
  measureIndex: number,
  degree: ScaleDegree,
  beat: number,
  duration: number,
): Omit<ChordEvent, 'id'> {
  const scale = getScaleAtMeasure(song, measureIndex);
  return {
    scaleDegree: degree,
    quality: theoryEngine.getDiatonicQuality(degree, scale),
    seventh: theoryEngine.getDiatonicSeventh(degree, scale),
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat,
    duration,
  };
}

export function buildDefaultNotePayload(
  song: SongData,
  measureIndex: number,
  degree: ScaleDegree,
  beat: number,
  duration: number,
): Omit<NoteEvent, 'id'> {
  void song;
  void measureIndex;
  return {
    scaleDegree: degree,
    octave: 0,
    chromatic: 0,
    beat,
    duration,
    isRest: false,
    velocity: 100,
  };
}

/**
 * UI-W4 — choose relative octave so a new/edited pitch sits nearest the previous melody pitch in the
 * same voice (Hookpad-style “smart octave”). When there is no prior note, returns `0`.
 */
export function pickSmartOctaveForNewNote(
  song: SongData,
  measureIndex: number,
  voice: 0 | 1 | 2 | 3,
  insertBeat: number,
  degree: ScaleDegree,
  chromatic: number,
): number {
  const prevMidi = findPreviousMelodyMidiInVoice(song, measureIndex, voice, insertBeat);
  if (prevMidi == null) {
    return 0;
  }
  const { key, scale } = getKeyScaleAtMeasure(song, measureIndex);
  return pickOctaveNearestToMidi(degree, chromatic, key, scale, prevMidi);
}

function findPreviousMelodyMidiInVoice(
  song: SongData,
  measureIndex: number,
  voice: 0 | 1 | 2 | 3,
  insertBeat: number,
): number | null {
  for (let m = measureIndex; m >= 0; m--) {
    const lane = song.measures[m]?.notes[voice] ?? [];
    const { key, scale } = getKeyScaleAtMeasure(song, m);
    if (m === measureIndex) {
      let best: NoteEvent | null = null;
      for (const n of lane) {
        if (n.isRest) continue;
        if (n.beat < insertBeat && (!best || n.beat > best.beat)) {
          best = n;
        }
      }
      if (best) {
        return scaleDegreeToMidi(best.scaleDegree, best.octave, best.chromatic, key, scale, 4);
      }
    } else {
      let best: NoteEvent | null = null;
      for (const n of lane) {
        if (n.isRest) continue;
        if (!best || n.beat > best.beat) {
          best = n;
        }
      }
      if (best) {
        return scaleDegreeToMidi(best.scaleDegree, best.octave, best.chromatic, key, scale, 4);
      }
    }
  }
  return null;
}

function pickOctaveNearestToMidi(
  degree: ScaleDegree,
  chromatic: number,
  key: NoteName,
  scale: ScaleType,
  referenceMidi: number,
): number {
  let bestOct = 0;
  let bestDist = Infinity;
  for (let o = -2; o <= 2; o++) {
    const m = scaleDegreeToMidi(degree, o, chromatic, key, scale, 4);
    const d = Math.abs(m - referenceMidi);
    if (d < bestDist) {
      bestDist = d;
      bestOct = o;
    }
  }
  return bestOct;
}

/** Smart octave when editing an existing note’s scale degree in text mode — stay close to the prior pitch. */
export function pickSmartOctaveForDegreeEdit(
  song: SongData,
  measureIndex: number,
  degree: ScaleDegree,
  chromatic: number,
  previous: NoteEvent,
): number {
  const { key, scale } = getKeyScaleAtMeasure(song, measureIndex);
  const prevMidi = scaleDegreeToMidi(
    previous.scaleDegree,
    previous.octave,
    previous.chromatic,
    key,
    scale,
    4,
  );
  return pickOctaveNearestToMidi(degree, chromatic, key, scale, prevMidi);
}

/** Rest placement — `scaleDegree` / `octave` / `chromatic` ignored when `isRest` (INTERFACES.md). */
export function buildRestNotePayload(beat: number, duration: number): Omit<NoteEvent, 'id'> {
  return {
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    beat,
    duration,
    isRest: true,
    velocity: 100,
  };
}

/** Chords + active-voice notes in one measure, sorted by beat; chord wins ties (TASK-2.8). */
export function mergedChordAndVoiceNoteIds(
  measure: Measure,
  activeVoice: 0 | 1 | 2 | 3,
): Array<{ kind: 'chord' | 'note'; id: string }> {
  type Item = { kind: 'chord' | 'note'; id: string; beat: number };
  const items: Item[] = [];
  for (const c of measure.chords) {
    items.push({ kind: 'chord', id: c.id, beat: c.beat });
  }
  for (const n of measure.notes[activeVoice]) {
    items.push({ kind: 'note', id: n.id, beat: n.beat });
  }
  items.sort((a, b) => {
    if (a.beat !== b.beat) return a.beat - b.beat;
    if (a.kind !== b.kind) return a.kind === 'chord' ? -1 : 1;
    return 0;
  });
  return items.map(({ kind, id }) => ({ kind, id }));
}

export function navigationStream(
  selection: Selection | null,
  entryMode: 'table' | 'text',
): 'chord' | 'note' | null {
  if (selection?.type === 'note') return 'note';
  if (selection?.type === 'chord' || selection?.type === 'range') return 'chord';
  if (!selection) {
    if (entryMode === 'table') return 'chord';
    return null;
  }
  return 'chord';
}

function selectionFromMergedItem(e: { measureIndex: number; kind: 'chord' | 'note'; id: string }): Selection {
  if (e.kind === 'chord') return { type: 'chord', measureIndex: e.measureIndex, eventIds: [e.id] };
  return { type: 'note', measureIndex: e.measureIndex, eventIds: [e.id] };
}

function findLastIndex<T>(arr: T[], pred: (t: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
}

/** Merged chords + activeVoice notes across all measures (beat timeline for chord-context arrows). */
function navigateMergedAcrossMeasures(
  song: SongData,
  viewport: Viewport,
  selection: Selection | null,
  activeVoice: 0 | 1 | 2 | 3,
  direction: -1 | 1,
): Selection | null {
  const list: { measureIndex: number; kind: 'chord' | 'note'; id: string }[] = [];
  for (let mi = 0; mi < song.measures.length; mi++) {
    const m = song.measures[mi];
    if (!m) continue;
    for (const it of mergedChordAndVoiceNoteIds(m, activeVoice)) {
      list.push({ measureIndex: mi, kind: it.kind, id: it.id });
    }
  }
  if (list.length === 0) return null;

  const startMeasure = resolveTargetMeasureIndex(selection, viewport, song);
  let curIdx = -1;
  if (selection?.type === 'chord' && selection.eventIds?.[0]) {
    const id = selection.eventIds[0];
    curIdx = list.findIndex((e) => e.kind === 'chord' && e.id === id);
  } else if (selection?.type === 'note' && selection.eventIds?.[0]) {
    const id = selection.eventIds[0];
    curIdx = list.findIndex((e) => e.kind === 'note' && e.id === id);
  }

  if (curIdx < 0) {
    if (direction === 1) {
      const firstInMeasure = list.findIndex((e) => e.measureIndex >= startMeasure);
      const pick = firstInMeasure >= 0 ? firstInMeasure : 0;
      return selectionFromMergedItem(list[pick]);
    }
    const lastBefore = findLastIndex(list, (e) => e.measureIndex < startMeasure);
    const pick = lastBefore >= 0 ? lastBefore : list.length - 1;
    return selectionFromMergedItem(list[pick]);
  }

  const nextIdx = (curIdx + direction + list.length) % list.length;
  return selectionFromMergedItem(list[nextIdx]);
}

export function navigateSelection(
  song: SongData,
  viewport: Viewport,
  selection: Selection | null,
  activeVoice: 0 | 1 | 2 | 3,
  direction: -1 | 1,
  entryMode: 'table' | 'text',
): Selection | null {
  if (navigationStream(selection, entryMode) == null) return null;
  if (song.measures.length === 0) return null;

  // Single beat-ordered timeline: chords + activeVoice notes (TASK-2.8 / QA).
  return navigateMergedAcrossMeasures(song, viewport, selection, activeVoice, direction);
}
