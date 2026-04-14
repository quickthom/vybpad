import type { SongData, Viewport } from '@vybpad/shared';

import { PLAYBACK_CURSOR_COLOR, PLAYBACK_CURSOR_WIDTH } from './constants';
import { absoluteTickToViewportX } from './layout';

/**
 * Vertical playback cursor: full-height line aligned to {@link absoluteTickToViewportX} (TASK-4.6 / UX §6).
 */
export function drawPlaybackCursor(
  ctx: CanvasRenderingContext2D,
  song: SongData,
  viewport: Viewport,
  playbackTick: number | null,
  canvasHeightCssPx: number,
): void {
  if (playbackTick == null) {
    return;
  }
  const x = Math.round(absoluteTickToViewportX(playbackTick, viewport, song)) + 0.5;
  ctx.save();
  ctx.strokeStyle = PLAYBACK_CURSOR_COLOR;
  ctx.lineWidth = PLAYBACK_CURSOR_WIDTH;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, canvasHeightCssPx);
  ctx.stroke();
  ctx.restore();
}
