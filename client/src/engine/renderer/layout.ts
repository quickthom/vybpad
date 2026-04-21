import type { NoteEvent, ScaleDegree, SongData, Viewport } from '@vybpad/shared';

import {
  BEAT_WIDTH,
  CHORD_AREA_HEIGHT,
  CHORD_LETTER_STRIP_HEIGHT,
  MEASURE_HEADER_HEIGHT,
  MELODY_DIATONIC_ROW_COUNT,
  NOTE_HEIGHT,
} from './constants';
import {
  getMeasureStartTicks,
  getMeterAtMeasure,
  measureIndexFromAbsoluteTick,
  measureLengthInTicks,
  TPQN,
} from './tickUtils';
import { computeVoicePitchRanges } from './voicePitchRange';
import type { VoicePitchRange } from './voicePitchRange';
import { scaleDegreeToMidi } from '../theory/scaleDegreeToMidi';

// Re-export PAT-012 and tick helpers for the public barrel
export {
  BEAT_WIDTH,
  CHORD_AREA_HEIGHT,
  CHORD_LETTER_STRIP_HEIGHT,
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
 * Convert an absolute song tick to `{ measureIndex, beat }` using song-local meter changes.
 * Values outside `[0, totalTicks)` are clamped to the nearest valid song tick.
 */
export function measureIndexAndBeatFromAbsoluteTick(song: SongData, absoluteTick: number): { measureIndex: number; beat: number } {
  if (!Number.isFinite(absoluteTick) || song.measures.length === 0) {
    return { measureIndex: 0, beat: 0 };
  }
  const starts = getMeasureStartTicks(song);
  const totalTicks = starts[song.measures.length] ?? 0;
  const clamped = Math.max(0, Math.min(Math.round(absoluteTick), Math.max(0, totalTicks - 1)));
  const measureIndex = measureIndexFromAbsoluteTick(song, clamped);
  return { measureIndex, beat: clamped - (starts[measureIndex] ?? 0) };
}

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
 * Top Y of the bottom chord track band (RA-2 / UI-W2). The roman band is
 * {@link CHORD_AREA_HEIGHT} tall, with a dedicated {@link CHORD_LETTER_STRIP_HEIGHT}
 * label strip beneath it.
 */
export function bottomChordStripTopY(
  melodyRowHeight: number = NOTE_HEIGHT,
  melodyRowCount: number = MELODY_DIATONIC_ROW_COUNT,
): number {
  return MEASURE_HEADER_HEIGHT + melodyRowCount * melodyRowHeight;
}

/**
 * Canvas Y scaling helper for melody row height at the current vertical zoom factor.
 * `zoomY` is intentionally a pure layout-only multiplier and does not affect X-axis timing.
 */
export function scaleMelodyRowHeight(rowHeight: number = NOTE_HEIGHT, zoomY: number = 1): number {
  const h = Number.isFinite(rowHeight) ? rowHeight : NOTE_HEIGHT;
  const z = Number.isFinite(zoomY) && zoomY > 0 ? zoomY : 1;
  return h * z;
}

/** Combined height for the roman band plus label strip (PAT-012 + UX §6). */
export const CHORD_STRIP_TOTAL_HEIGHT = CHORD_AREA_HEIGHT + CHORD_LETTER_STRIP_HEIGHT;

/**
 * PAT-018: chromatic alteration shifts the note vertically by half a row per semitone step.
 */
export function chromaticYOffset(chromatic: number, rowHeight: number = NOTE_HEIGHT): number {
  return chromatic * (rowHeight / 2);
}

const MIDI_TO_STAFF_ROW_CHROMATICS = [-1, 0, 1, -2, 2] as const;

/** Convert absolute MIDI pitch to the staff row coordinate used by {@link noteRowY}. */
export function midiToStaffRowOffset(midiPitch: number): number {
  for (let octave = -8; octave <= 12; octave++) {
    for (let degree = 1; degree <= 7; degree++) {
      for (const chromatic of MIDI_TO_STAFF_ROW_CHROMATICS) {
        const candidatePitch = scaleDegreeToMidi(degree as ScaleDegree, octave, chromatic, 'C', 'major', 4);
        if (candidatePitch === Math.round(midiPitch)) {
          return octave * 7 + (degree - 1) + chromatic / 2;
        }
      }
    }
  }
  return 0;
}

/** Convert a staff row offset back to nearest representable MIDI pitch. */
export function staffRowToNearestMidiPitch(staffRow: number): number {
  let bestPitch = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestChromAbs = Number.POSITIVE_INFINITY;
  for (let octave = -8; octave <= 12; octave++) {
    for (let degree = 1; degree <= 7; degree++) {
      for (const chromatic of MIDI_TO_STAFF_ROW_CHROMATICS) {
        const row = octave * 7 + (degree - 1) + chromatic / 2;
        const pitch = scaleDegreeToMidi(degree as ScaleDegree, octave, chromatic, 'C', 'major', 4);
        const distance = Math.abs(row - staffRow);
        if (distance < bestDistance || (distance === bestDistance && Math.abs(chromatic) < bestChromAbs)) {
          bestDistance = distance;
          bestChromAbs = Math.abs(chromatic);
          bestPitch = pitch;
          if (distance === 0) {
            return pitch;
          }
        }
      }
    }
  }
  return bestPitch;
}

/** Number of staff rows needed to represent a pitch window. Returns legacy count when absent. */
export function melodyPitchRangeRowCount(
  range: Pick<VoicePitchRange, 'minPitch' | 'maxPitch'> | null | undefined,
): number {
  if (!range) {
    return MELODY_DIATONIC_ROW_COUNT;
  }
  const minRow = midiToStaffRowOffset(range.minPitch);
  const maxRow = midiToStaffRowOffset(range.maxPitch);
  const span = Math.max(minRow, maxRow) - Math.min(minRow, maxRow);
  return Math.max(1, Math.ceil(span) + 1);
}

/** Staff row anchor offset for a pitch window; defaults to zero when not provided. */
export function melodyPitchRangeTopRowOffset(
  range: Pick<VoicePitchRange, 'minPitch'> | null | undefined,
): number {
  if (!range) {
    return 0;
  }
  return midiToStaffRowOffset(range.minPitch);
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
  const sd = (((row % 7) + 7) % 7) + 1;
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
  melodyVoicePitchRange?: Pick<VoicePitchRange, 'minPitch'>,
): number {
  const base = noteStaffTopY();
  const row = diatonicRowIndex(scaleDegree, octave) + chromatic / 2;
  return base + (row - melodyPitchRangeTopRowOffset(melodyVoicePitchRange)) * rowHeight - scrollY;
}

/** Layout Y for a {@link NoteEvent} (callers skip rests). */
export function noteRowYFromNoteEvent(
  note: NoteEvent,
  scrollY: number,
  rowHeight: number = NOTE_HEIGHT,
  melodyVoicePitchRange?: Pick<VoicePitchRange, 'minPitch'>,
): number {
  return noteRowY(note.scaleDegree, note.octave, note.chromatic, scrollY, rowHeight, melodyVoicePitchRange);
}

/**
 * OB-14: returns per-voice min/max MIDI pitch bounds for melody voices 0..3.
 *
 * - Rests are ignored.
 * - Chromatic offsets are part of the pitch metric.
 * - Voices with no non-rest notes return the neutral fallback range.
 * - Spans with material are expanded to at least one octave.
 */
export function computeMelodyVoicePitchRanges(song: SongData): ReturnType<typeof computeVoicePitchRanges> {
  return computeVoicePitchRanges(song);
}
