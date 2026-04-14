import type { ChordEvent, Measure, NoteEvent, ScaleDegree, Selection, SongData, Viewport } from '@vybpad/shared';

import { chordAreaTopY, noteStaffTopY, viewportXToAbsoluteTick } from '../../engine/renderer/layout';
import {
  getMeterAtMeasure,
  getScaleAtMeasure,
  measureIndexFromAbsoluteTick,
  measureLengthInTicks,
} from '../../engine/renderer/tickUtils';
import { theoryEngine } from '../../engine/theory';

/**
 * PAT-004 durations. Primary row: h j k l ; (TASK-2.8 / UX).
 * q w e r t are accepted as aliases so existing shortcuts/tests remain valid.
 */
export const DURATION_KEYS: Record<string, number> = {
  h: 192,
  j: 96,
  k: 48,
  l: 24,
  ';': 12,
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
): Selection | null {
  if (viewportY < chordAreaTopY() || viewportY >= noteStaffTopY()) {
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
