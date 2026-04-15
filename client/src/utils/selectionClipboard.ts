/**
 * TASK-7.4 — selection JSON clipboard (INTERFACES + PAT-028).
 * Build/validate slices; paste anchoring is documented on {@link getPasteAnchor}.
 */

import type {
  ChordEvent,
  ClipboardMeasureSlice,
  Measure,
  NoteEvent,
  Selection,
  SelectionClipboardPayload,
  SongData,
} from '@vybpad/shared';

import {
  getMeasureStartTicks,
  getMeterAtMeasure,
  measureIndexFromAbsoluteTick,
  measureLengthInTicks,
} from '../engine/renderer/tickUtils';

function measureLen(song: SongData, measureIndex: number): number {
  const m = song.measures[measureIndex];
  if (!m) return 0;
  return measureLengthInTicks(getMeterAtMeasure(song, measureIndex));
}

function rangesOverlap(
  lo: number,
  hi: number,
  start: number,
  endExclusive: number,
): boolean {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  return start < b + 1 && endExclusive > a;
}

/** True when the user has something to copy (non-empty event set or range with defined bounds). */
export function isCopyableSelection(selection: Selection | null): boolean {
  if (!selection) return false;
  if (selection.type === 'range') {
    return selection.rangeStart !== undefined && selection.rangeEnd !== undefined;
  }
  return (selection.eventIds?.length ?? 0) > 0;
}

/**
 * Extract chords/notes from the song for the current selection.
 * Returns one slice at `measureOffset: 0` (single-measure editor selection model).
 */
export function buildClipboardMeasureSlices(
  song: SongData,
  selection: Selection,
): ClipboardMeasureSlice[] | null {
  const mi = selection.measureIndex;
  const measure = song.measures[mi];
  if (!measure) return null;

  if (selection.type === 'chord') {
    const ids = new Set(selection.eventIds ?? []);
    if (ids.size === 0) return null;
    const chords = measure.chords.filter((c) => ids.has(c.id)).map((c) => structuredClone(c));
    if (chords.length === 0) return null;
    const notes: NoteEvent[][] = [[], [], [], []];
    return [{ measureOffset: 0, chords, notes, changes: cloneChanges(measure.changes) }];
  }

  if (selection.type === 'note') {
    const ids = new Set(selection.eventIds ?? []);
    if (ids.size === 0) return null;
    const notes: NoteEvent[][] = [[], [], [], []];
    let any = false;
    for (let v = 0; v < 4; v++) {
      for (const n of measure.notes[v]) {
        if (ids.has(n.id)) {
          notes[v].push(structuredClone(n));
          any = true;
        }
      }
    }
    if (!any) return null;
    return [{ measureOffset: 0, chords: [], notes, changes: cloneChanges(measure.changes) }];
  }

  // range — measure-local ticks when max(range) fits in one bar; otherwise treat as absolute song ticks (multi-measure).
  const rs = selection.rangeStart ?? 0;
  const re = selection.rangeEnd ?? 0;
  const lo = Math.min(rs, re);
  const hi = Math.max(rs, re);
  const len = measureLen(song, mi);
  if (len <= 0) return null;

  if (hi < len) {
    const chords: ChordEvent[] = [];
    for (const c of measure.chords) {
      const end = c.beat + c.duration;
      if (rangesOverlap(lo, hi, c.beat, end)) {
        chords.push(structuredClone(c));
      }
    }
    const notes: NoteEvent[][] = [[], [], [], []];
    for (let v = 0; v < 4; v++) {
      for (const n of measure.notes[v]) {
        const end = n.beat + n.duration;
        if (rangesOverlap(lo, hi, n.beat, end)) {
          notes[v].push(structuredClone(n));
        }
      }
    }
    if (chords.length === 0 && notes.every((lane) => lane.length === 0)) return null;
    return [{ measureOffset: 0, chords, notes, changes: cloneChanges(measure.changes) }];
  }

  const absSongLo = lo;
  const absSongHi = hi;
  const starts = getMeasureStartTicks(song);
  type Acc = {
    idx: number;
    chords: ChordEvent[];
    notes: NoteEvent[][];
    changes?: Measure['changes'];
  };
  const nonEmpty: Acc[] = [];
  for (let i = 0; i < song.measures.length; i++) {
    const mStart = starts[i];
    const mEndEx = starts[i + 1];
    const segLo = Math.max(absSongLo, mStart);
    const segHi = Math.min(absSongHi, mEndEx - 1);
    if (segLo > segHi) continue;
    const localLo = segLo - mStart;
    const localHi = segHi - mStart;
    const m = song.measures[i];
    const chords: ChordEvent[] = [];
    for (const c of m.chords) {
      const end = c.beat + c.duration;
      if (rangesOverlap(localLo, localHi, c.beat, end)) {
        chords.push(structuredClone(c));
      }
    }
    const notes: NoteEvent[][] = [[], [], [], []];
    for (let v = 0; v < 4; v++) {
      for (const n of m.notes[v]) {
        const end = n.beat + n.duration;
        if (rangesOverlap(localLo, localHi, n.beat, end)) {
          notes[v].push(structuredClone(n));
        }
      }
    }
    if (chords.length === 0 && notes.every((lane) => lane.length === 0)) continue;
    nonEmpty.push({ idx: i, chords, notes, changes: cloneChanges(m.changes) });
  }
  if (nonEmpty.length === 0) return null;
  const baseIdx = Math.min(...nonEmpty.map((s) => s.idx));
  return nonEmpty.map((s) => ({
    measureOffset: s.idx - baseIdx,
    chords: s.chords,
    notes: s.notes,
    changes: s.changes,
  }));
}

function cloneChanges(c: Measure['changes']): Measure['changes'] | undefined {
  return c ? structuredClone(c) : undefined;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Strict runtime guard — rejects malformed payloads (paste no-op). */
export function validateSelectionClipboardPayload(parsed: unknown): SelectionClipboardPayload | null {
  if (!isPlainObject(parsed)) return null;
  if (parsed.version !== 1) return null;
  if (parsed.source !== 'vybpad') return null;
  if (parsed.kind !== 'selection') return null;
  if (typeof parsed.copiedAt !== 'string') return null;
  if (!isPlainObject(parsed.selection)) return null;
  const sel = parsed.selection;
  if (sel.type !== 'chord' && sel.type !== 'note' && sel.type !== 'range') return null;
  if (typeof sel.measureIndex !== 'number' || !Number.isInteger(sel.measureIndex) || sel.measureIndex < 0) {
    return null;
  }
  if (!Array.isArray(parsed.measures) || parsed.measures.length === 0) return null;

  const measures: ClipboardMeasureSlice[] = [];
  let eventCount = 0;
  for (const m of parsed.measures) {
    if (!isPlainObject(m)) return null;
    if (typeof m.measureOffset !== 'number' || !Number.isInteger(m.measureOffset) || m.measureOffset < 0) {
      return null;
    }
    if (!Array.isArray(m.chords)) return null;
    if (!Array.isArray(m.notes) || m.notes.length !== 4) return null;
    for (const lane of m.notes) {
      if (!Array.isArray(lane)) return null;
    }
    eventCount += m.chords.length;
    for (const lane of m.notes as NoteEvent[][]) {
      eventCount += lane.length;
    }
    measures.push({
      measureOffset: m.measureOffset,
      chords: m.chords as ChordEvent[],
      notes: m.notes as NoteEvent[][],
      changes: m.changes !== undefined ? (m.changes as Measure['changes']) : undefined,
    });
  }
  if (eventCount === 0) return null;

  return {
    version: 1,
    kind: 'selection',
    source: 'vybpad',
    copiedAt: parsed.copiedAt,
    selection: parsed.selection as unknown as Selection,
    measures,
  };
}

export function parseSelectionClipboardPayloadJson(text: string): SelectionClipboardPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  return validateSelectionClipboardPayload(parsed);
}

/**
 * Paste destination (TASK-7.4):
 * - Requires a non-null {@link Selection} from the UI store.
 * - `chord` / `note`: merge into `measureIndex` starting at **beat 0** (destination measure only; QA TASK-7.4).
 * - `range`: measure-local range → anchor = min(rangeStart, rangeEnd); absolute span (max ≥ measure length)
 *   → anchor is the local tick where `min` absolute song tick falls.
 */
export function getPasteAnchor(
  song: SongData,
  selection: Selection | null,
): { measureIndex: number; anchorBeat: number } | null {
  if (!selection) return null;
  const mi = selection.measureIndex;
  const measure = song.measures[mi];
  if (!measure) return null;

  if (selection.type === 'range') {
    if (selection.rangeStart === undefined || selection.rangeEnd === undefined) return null;
    const rs = selection.rangeStart;
    const re = selection.rangeEnd;
    const lo = Math.min(rs, re);
    const hi = Math.max(rs, re);
    const localLen = measureLen(song, mi);
    if (hi < localLen) {
      return { measureIndex: mi, anchorBeat: lo };
    }
    const absLo = Math.min(rs, re);
    const idx = measureIndexFromAbsoluteTick(song, absLo);
    const starts = getMeasureStartTicks(song);
    const anchorBeat = absLo - (starts[idx] ?? 0);
    return { measureIndex: idx, anchorBeat };
  }

  if (selection.type === 'chord' || selection.type === 'note') {
    return { measureIndex: mi, anchorBeat: 0 };
  }

  return null;
}

export function minBeatInSlice(slice: ClipboardMeasureSlice): number | null {
  let minB = Infinity;
  for (const c of slice.chords) {
    minB = Math.min(minB, c.beat);
  }
  for (let v = 0; v < 4; v++) {
    for (const n of slice.notes[v]) {
      minB = Math.min(minB, n.beat);
    }
  }
  return Number.isFinite(minB) ? minB : null;
}

/** Minimum beat among slices with the smallest `measureOffset` (anchor row for PAT-028 paste alignment). */
export function minBeatAtMinMeasureOffset(slices: ClipboardMeasureSlice[]): number | null {
  if (slices.length === 0) return null;
  const minOff = Math.min(...slices.map((s) => s.measureOffset));
  let minB = Infinity;
  for (const s of slices) {
    if (s.measureOffset !== minOff) continue;
    const m = minBeatInSlice(s);
    if (m !== null) minB = Math.min(minB, m);
  }
  return Number.isFinite(minB) ? minB : null;
}
