import type { NoteName, ScaleType, SongData, Viewport } from '@vybpad/shared';

import { MELODY_DIATONIC_ROW_COUNT, NOTE_HEIGHT, PITCH_GUTTER_WIDTH } from './constants';
import {
  noteStaffTopY,
  melodyPitchRangeRowCount,
  midiToStaffRowOffset,
  diatonicRowToDegreeAndOctave,
} from './layout';
import type { VoicePitchRange } from './voicePitchRange';
import { getScaleIntervals } from '../theory/scales';
import { noteNameToMidiBase } from '../theory/noteNames';
import { getKeyAtMeasure, getScaleAtMeasure } from './tickUtils';
import { scaleDegreeToMidi } from '../theory/scaleDegreeToMidi';

/**
 * One Y-axis pitch label for the melody piano-roll gutter (RA-1 / UI-W1).
 * Drawn in viewport coordinates; `centerY` aligns with the vertical center of the diatonic row
 * (same space as {@link noteRowY} / {@link computeNoteBlockRect}).
 */
export interface PitchAxisViewportLabel {
  /** Diatonic ladder index (same convention as {@link diatonicRowIndex}). */
  diatonicRowIndex: number;
  /** Viewport Y of the row centerline. */
  centerY: number;
  /**
   * Primary gutter text (UX_GUIDELINES.md §2 canvas labels — structure not pixels).
   * RA-206: note label text only (`C`, `D♭`, `F♯`) without octave digits.
   */
  primary: string;
  /** Optional caption-tier line (UX §2 `caption`). */
  secondary?: string;
}

const LETTER_RING = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
type Letter = (typeof LETTER_RING)[number];
const NATURAL_PC_BY_LETTER: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const ACCIDENTAL_SYMBOLS: Record<-2 | -1 | 0 | 1 | 2, string> = {
  0: '',
  1: '♯',
  '-1': '♭',
  2: '##',
  '-2': 'bb',
};

function diatonicLettersForKey(key: NoteName): readonly string[] {
  const start = LETTER_RING.indexOf(key[0] as Letter);
  const out: string[] = [];
  for (let i = 0; i < LETTER_RING.length; i++) {
    out.push(LETTER_RING[(start + i) % LETTER_RING.length]);
  }
  return out;
}

function spellPitchWithAccidentalPreference(
  letter: string,
  targetPc: number,
  accidentalOrder: ReadonlyArray<-2 | -1 | 0 | 1 | 2>,
): string | null {
  const natural = NATURAL_PC_BY_LETTER[letter as Letter];
  const normalized = ((targetPc % 12) + 12) % 12;
  for (const delta of accidentalOrder) {
    if (((natural + delta + 1200) % 12) === normalized) {
      return `${letter}${ACCIDENTAL_SYMBOLS[delta]}`;
    }
  }
  return null;
}

/**
 * Fallback for no key/scale context.
 * Kept flat-first for equal-altitude ambiguities (for example C♯/D♭), matching existing project convention in RA-206 coverage.
 */
function fallbackPitchLabelFromPc(pc: number): string {
  const normalized = ((pc % 12) + 12) % 12;
  const accidentalPreference: Array<-2 | -1 | 0 | 1 | 2> = [0, -1, 1, -2, 2];
  for (const delta of accidentalPreference) {
    for (const letter of LETTER_RING) {
      const spelled = spellPitchWithAccidentalPreference(letter, normalized, [delta]);
      if (spelled != null) return spelled;
    }
  }
  return 'C';
}

function contextAwarePitchLabel(pc: number, key: NoteName, scale: ScaleType): string {
  const tonic = noteNameToMidiBase(key) % 12;
  const intervals = getScaleIntervals(scale);
  const letters = diatonicLettersForKey(key);
  for (let i = 0; i < intervals.length; i++) {
    if (i >= letters.length) break;
    const targetPc = ((tonic + intervals[i]) % 12 + 12) % 12;
    if (targetPc !== pc) continue;
    const spelled = spellPitchWithAccidentalPreference(letters[i], targetPc, [0, -1, 1, -2, 2]);
    if (spelled != null) return spelled;
  }
  return fallbackPitchLabelFromPc(pc);
}

/** Width of the left pitch gutter in CSS px (re-export for shell layout). */
export { PITCH_GUTTER_WIDTH };

/** Letter-only pitch label from MIDI (0–127); uses Unicode ♯/♭ for accidentals.
 * Context-aware when key/scale are provided.
 * No-context fallback uses flat-first preference.
 */
export function midiToScientificPitchLabel(midi: number, key?: NoteName, scale?: ScaleType): string {
  const m = Math.max(0, Math.min(127, Math.round(midi)));
  const pc = ((m % 12) + 12) % 12;
  if (key != null && scale != null) {
    return contextAwarePitchLabel(pc, key, scale);
  }
  return fallbackPitchLabelFromPc(pc);
}

/**
 * Computes pitch-row labels for the left melody gutter for the current viewport.
 * One label per visible diatonic row intersecting the canvas; key/scale come from the first visible measure.
 */
export function computePitchAxisLabelsInViewport(
  song: SongData,
  viewport: Viewport,
  canvasHeight: number,
  melodyRowHeight: number = NOTE_HEIGHT,
  melodyPitchRange?: Pick<VoicePitchRange, 'minPitch' | 'maxPitch'>,
): readonly PitchAxisViewportLabel[] {
  const staffTop = noteStaffTopY();
  const key = getKeyAtMeasure(song, viewport.startMeasure);
  const scale = getScaleAtMeasure(song, viewport.startMeasure);
  const rowCount = melodyPitchRange ? melodyPitchRangeRowCount(melodyPitchRange) : MELODY_DIATONIC_ROW_COUNT;
  const topRowOffset = melodyPitchRange ? midiToStaffRowOffset(melodyPitchRange.minPitch) : 0;

  const out: PitchAxisViewportLabel[] = [];
  for (let r = 0; r < rowCount; r++) {
    const absoluteRow = topRowOffset + r;
    const { scaleDegree, octave } = diatonicRowToDegreeAndOctave(absoluteRow);
    const midi = scaleDegreeToMidi(scaleDegree, octave, 0, key, scale, 4);
    const rowTop = staffTop + r * melodyRowHeight - viewport.scrollY;
    const rowBottom = rowTop + melodyRowHeight;
    if (rowBottom <= 0 || rowTop >= canvasHeight) {
      continue;
    }
    const primary = midiToScientificPitchLabel(midi, key, scale);
    const centerY = staffTop + r * melodyRowHeight + melodyRowHeight / 2 - viewport.scrollY;

    out.push({ diatonicRowIndex: r, centerY, primary });
  }
  return out;
}

/**
 * Draws pitch labels into the left `[0, gutterWidth)` strip (call **before** `translate` for the main grid
 * or use absolute coordinates with `x < gutterWidth`).
 */
export function drawPitchAxisGutter(
  ctx: CanvasRenderingContext2D,
  labels: readonly PitchAxisViewportLabel[],
  gutterWidthPx: number = PITCH_GUTTER_WIDTH,
): void {
  const padRight = 6;
  ctx.save();
  ctx.font = '600 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';
  ctx.fillStyle = '#4B5563';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const l of labels) {
    ctx.fillText(l.primary, gutterWidthPx - padRight, l.centerY);
    if (l.secondary) {
      ctx.font = '400 10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = '#9CA3AF';
      ctx.fillText(l.secondary, gutterWidthPx - padRight, l.centerY + 9);
      ctx.font = '600 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';
      ctx.fillStyle = '#4B5563';
    }
  }
  ctx.restore();
}
