import type { SongData, Viewport } from '@vybpad/shared';

import {
  MELODY_DIATONIC_ROW_COUNT,
  NOTE_HEIGHT,
  PLAYBACK_HIGHLIGHT_COLOR,
  PLAYBACK_HIGHLIGHT_LINE_WIDTH,
} from './constants';
import { CHORD_BLOCK_CORNER_RADIUS, layoutChordBlock } from './chordBlocks';
import { computeNoteBlockRect, NOTE_BLOCK_CORNER_RADIUS } from './noteBlocks';
import { absoluteTickFromMeasurePosition } from './tickUtils';
import type { VoicePitchRange } from './voicePitchRange';

/**
 * UX §6 — notes/chords sounding at `playbackTick`: 2px stroke `#F59E0B` on top of blocks.
 * Half-open interval [start, end) in absolute ticks.
 */
export function drawPlaybackHighlight(
  ctx: CanvasRenderingContext2D,
  song: SongData,
  viewport: Viewport,
  playbackTick: number | null,
  melodyRowHeight: number = NOTE_HEIGHT,
  melodyVoicePitchRange?: Pick<VoicePitchRange, 'minPitch'>,
  melodyRowCount: number = MELODY_DIATONIC_ROW_COUNT,
  melodyVoiceVisible: readonly [boolean, boolean, boolean, boolean] = [true, true, true, true],
): void {
  if (playbackTick == null) {
    return;
  }

  const start = viewport.startMeasure;
  const end = Math.min(start + viewport.measureCount, song.measures.length);

  ctx.save();
  ctx.strokeStyle = PLAYBACK_HIGHLIGHT_COLOR;
  ctx.lineWidth = PLAYBACK_HIGHLIGHT_LINE_WIDTH;
  ctx.setLineDash([]);

  for (let mi = start; mi < end; mi++) {
    const measure = song.measures[mi];
    if (!measure) continue;

    for (const chord of measure.chords) {
      const absStart = absoluteTickFromMeasurePosition(song, mi, chord.beat);
      const absEnd = absStart + chord.duration;
      if (playbackTick < absStart || playbackTick >= absEnd) {
        continue;
      }
      const r = layoutChordBlock(chord, mi, song, viewport, melodyRowHeight, melodyRowCount);
      if (r.width <= 0) continue;
      strokeRoundRect(ctx, r.x, r.y, r.width, r.height, CHORD_BLOCK_CORNER_RADIUS);
    }

    const voices: readonly (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];
    for (const v of voices) {
      if (!melodyVoiceVisible[v]) {
        continue;
      }
      for (const note of measure.notes[v] ?? []) {
        if (note.isRest) continue;
        const absStart = absoluteTickFromMeasurePosition(song, mi, note.beat);
        const absEnd = absStart + note.duration;
        if (playbackTick < absStart || playbackTick >= absEnd) {
          continue;
        }
        const r = computeNoteBlockRect({
          song,
          viewport,
          measureIndex: mi,
          note,
          isRest: false,
          voiceIndex: v,
          melodyRowHeight,
          melodyVoicePitchRange,
        });
        strokeRoundRect(ctx, r.x, r.y, r.width, r.height, NOTE_BLOCK_CORNER_RADIUS);
      }
    }
  }

  ctx.restore();
}

function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, radius);
  ctx.stroke();
}
