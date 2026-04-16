import type { NoteEvent, ScaleDegree, SongData, Viewport } from '@vybpad/shared';

import { BEAT_WIDTH, MEASURE_HEADER_HEIGHT, MELODY_DIATONIC_ROW_COUNT, NOTE_HEIGHT } from './constants';
import { getMeasureStartTicks, getMeterAtMeasure, measureLengthInTicks, TPQN } from './tickUtils';

// Re-export PAT-012 and tick helpers for the public barrel
export {
  BEAT_WIDTH,
  CHORD_AREA_HEIGHT,
  MEASURE_HEADER_HEIGHT,
  MELODY_DIATONIC_ROW_COUNT,
  NOTE_HEIGHT,
  BAR_LINE_COLOR,
  GRID_LINE_COLOR,
  PLAYBACK_CURSOR_COLOR,
  PLAYBACK_CURSOR_WIDTH,
  SELECTION_COLOR,
} from './constants';
export {
  absoluteTickFromMeasurePosition,
  getKeyAtMeasure,
  getMeasureStartTicks,
  getMeterAtMeasure,
  getScaleAtMeasure,
  measureLengthInTicks,
  TPQN,
} from './tickUtils';

/**
 * Horizontal scale: one quarter-note beat is `BEAT_WIDTH * zoom` pixels (PAT-012).
 */
export function pixelsPerTick(zoom: number): number {
  return (BEAT_WIDTH * zoom) / TPQN;
}

/** Pure tick ↔ pixel mapping along the horizontal axis (no measure origin). */
export function horizontalTicksToPx(ticks: number, zoom: number): number {
  return ticks * pixelsPerTick(zoom);
}

/** Inverse of {@link horizontalTicksToPx}; rounds to the nearest tick (stable round-trip for QA cases). */
export function horizontalPxToTicks(px: number, zoom: number): number {
  const ppt = pixelsPerTick(zoom);
  return Math.round(px / ppt);
}

/** Absolute tick at the downbeat of `measureIndex` given per-measure lengths in ticks. */
export function measureStartAbsoluteTick(measureLengths: readonly number[], measureIndex: number): number {
  let t = 0;
  for (let i = 0; i < measureIndex; i++) {
    t += measureLengths[i] ?? 0;
  }
  return t;
}

function viewportOriginTickFromSong(viewport: Viewport, song: SongData): number {
  const starts = getMeasureStartTicks(song);
  return starts[viewport.startMeasure] ?? 0;
}

/** Distinguish `SongData` from a per-measure tick-length array for overload implementations. */
function isSongDataPayload(x: readonly number[] | SongData): x is SongData {
  return !Array.isArray(x);
}

/**
 * X relative to the viewport’s left edge (origin = downbeat of `viewport.startMeasure`).
 * Pass either a `measureLengths` array (ticks per measure) or full {@link SongData} for meter-aware layout.
 */
export function absoluteTickToViewportX(
  absoluteTick: number,
  viewport: Viewport,
  measureLengths: readonly number[],
): number;
export function absoluteTickToViewportX(absoluteTick: number, viewport: Viewport, song: SongData): number;
export function absoluteTickToViewportX(
  absoluteTick: number,
  viewport: Viewport,
  measureLengthsOrSong: readonly number[] | SongData,
): number {
  const originTick = isSongDataPayload(measureLengthsOrSong)
    ? viewportOriginTickFromSong(viewport, measureLengthsOrSong)
    : measureStartAbsoluteTick(measureLengthsOrSong, viewport.startMeasure);
  return horizontalTicksToPx(absoluteTick - originTick, viewport.zoom);
}

/**
 * Inverse of {@link absoluteTickToViewportX} for hit-testing and scrubbing.
 */
export function viewportXToAbsoluteTick(
  viewportX: number,
  viewport: Viewport,
  measureLengths: readonly number[],
): number;
export function viewportXToAbsoluteTick(viewportX: number, viewport: Viewport, song: SongData): number;
export function viewportXToAbsoluteTick(
  viewportX: number,
  viewport: Viewport,
  measureLengthsOrSong: readonly number[] | SongData,
): number {
  const originTick = isSongDataPayload(measureLengthsOrSong)
    ? viewportOriginTickFromSong(viewport, measureLengthsOrSong)
    : measureStartAbsoluteTick(measureLengthsOrSong, viewport.startMeasure);
  return originTick + horizontalPxToTicks(viewportX, viewport.zoom);
}

/** X offset from the start of the song (measure 0, tick 0) to `absoluteTick`. */
export function songXFromAbsoluteTick(absoluteTick: number, zoom: number): number {
  return horizontalTicksToPx(absoluteTick, zoom);
}

/** X offset from the start of the given measure to `tickOffsetInMeasure`. */
export function xFromMeasureLocalTick(tickOffsetInMeasure: number, zoom: number): number {
  return horizontalTicksToPx(tickOffsetInMeasure, zoom);
}

/** Pixel width of one measure (horizontal extent for its full meter at this zoom). */
export function measureWidthPixels(song: SongData, measureIndex: number, zoom: number): number {
  return measureLengthInTicks(getMeterAtMeasure(song, measureIndex)) * pixelsPerTick(zoom);
}

/** Top Y of the melody/note piano-roll (directly below measure header; RA-2 chord strip is at canvas bottom). */
export function noteStaffTopY(): number {
  return MEASURE_HEADER_HEIGHT;
}

/**
 * Top Y of the bottom chord track strip (RA-2 / UI-W2). Height = {@link CHORD_AREA_HEIGHT} (PAT-012), flush to canvas bottom.
 */
export function bottomChordStripTopY(melodyRowHeight: number = NOTE_HEIGHT): number {
  return MEASURE_HEADER_HEIGHT + MELODY_DIATONIC_ROW_COUNT * melodyRowHeight;
}

/**
 * PAT-018: chromatic alteration shifts the note vertically by half a row per semitone step.
 */
export function chromaticYOffset(chromatic: number, rowHeight: number = NOTE_HEIGHT): number {
  return chromatic * (rowHeight / 2);
}

/**
 * Diatonic row index within the grid: octave blocks of 7 scale-degree rows (degree 1 → lowest index in octave).
 */
export function diatonicRowIndex(scaleDegree: ScaleDegree, octave: number): number {
  return octave * 7 + (scaleDegree - 1);
}

/** Inverse of {@link diatonicRowIndex}: ladder row → scale degree + relative octave. */
export function diatonicRowToDegreeAndOctave(row: number): { scaleDegree: ScaleDegree; octave: number } {
  const octave = Math.floor(row / 7);
  const sd = (row % 7) + 1;
  return { scaleDegree: sd as ScaleDegree, octave };
}

/**
 * Canvas Y for the top edge of a note row. Larger row index moves downward on screen.
 * `scrollY` subtracts so the viewport can pan the pitch range.
 */
export function noteRowY(
  scaleDegree: ScaleDegree,
  octave: number,
  chromatic: number,
  scrollY: number,
  /** Melody row height from staff spacing (defaults to PAT-012 {@link NOTE_HEIGHT}). */
  rowHeight: number = NOTE_HEIGHT,
): number {
  const base = noteStaffTopY();
  const row = diatonicRowIndex(scaleDegree, octave);
  return base + row * rowHeight + chromaticYOffset(chromatic, rowHeight) - scrollY;
}

/** Layout Y for a {@link NoteEvent} (callers skip rests). */
export function noteRowYFromNoteEvent(note: NoteEvent, scrollY: number, rowHeight: number = NOTE_HEIGHT): number {
  return noteRowY(note.scaleDegree, note.octave, note.chromatic, scrollY, rowHeight);
}
