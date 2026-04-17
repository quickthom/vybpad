import type { SongData, Viewport } from '@vybpad/shared';

import { MELODY_DIATONIC_ROW_COUNT, NOTE_HEIGHT, PITCH_GUTTER_WIDTH } from './constants';
import { diatonicRowToDegreeAndOctave, noteStaffTopY } from './layout';
import { scaleDegreeToMidi } from '../theory/scaleDegreeToMidi';
import { getKeyAtMeasure, getScaleAtMeasure } from './tickUtils';

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
   * Absolute pitch: note letter only with PAT-018 accidentals (e.g. `C`, `F♯`).
   */
  primary: string;
  /** Optional caption-tier line (UX §2 `caption`). */
  secondary?: string;
}

/** Width of the left pitch gutter in CSS px (re-export for shell layout). */
export { PITCH_GUTTER_WIDTH };

/** Scientific pitch label from MIDI (0–127); uses Unicode ♯ for accidentals. */
export function midiToScientificPitchLabel(midi: number): string {
  const m = Math.max(0, Math.min(127, Math.round(midi)));
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
  const pc = ((m % 12) + 12) % 12;
  return names[pc];
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
): readonly PitchAxisViewportLabel[] {
  const staffTop = noteStaffTopY();
  const key = getKeyAtMeasure(song, viewport.startMeasure);
  const scale = getScaleAtMeasure(song, viewport.startMeasure);

  const out: PitchAxisViewportLabel[] = [];
  for (let r = 0; r < MELODY_DIATONIC_ROW_COUNT; r++) {
    const rowTop = staffTop + r * melodyRowHeight - viewport.scrollY;
    const rowBottom = rowTop + melodyRowHeight;
    if (rowBottom <= 0 || rowTop >= canvasHeight) {
      continue;
    }

    const { scaleDegree, octave } = diatonicRowToDegreeAndOctave(r);
    const midi = scaleDegreeToMidi(scaleDegree, octave, 0, key, scale, 4);
    const primary = midiToScientificPitchLabel(midi);
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
