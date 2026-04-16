import type { SongData, Viewport } from '@vybpad/shared';

import { NOTE_HEIGHT } from './constants';

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
   * Typically absolute note name + octave (e.g. `C4`, `F♯5`) or scale-degree + octave hint.
   */
  primary: string;
  /** Optional caption-tier line (UX §2 `caption` / roman line). */
  secondary?: string;
}

/**
 * Computes pitch-row labels that should appear in the left melody gutter for the current viewport.
 *
 * **UI-W1 stub:** returns an empty list until the Builder implements the piano-roll Y-axis (RA-1).
 * QA tests expect a non-empty list whenever the melody band is visible.
 */
export function computePitchAxisLabelsInViewport(
  _song: SongData,
  _viewport: Viewport,
  _canvasHeight: number,
  _melodyRowHeight: number = NOTE_HEIGHT,
): readonly PitchAxisViewportLabel[] {
  return [];
}
