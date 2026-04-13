import type { ChordEvent, SongData, Viewport } from '@vybpad/shared';

import { theoryEngine } from '../theory';
import {
  beginRoundRectPath,
  computeNoteBlockRect,
  getKeyScaleAtMeasure,
  noteBlockFillColor,
  NOTE_BLOCK_CORNER_RADIUS,
} from './noteBlocks';

/** UX §6 / TASK-2.12 — chord-tone strip height; bottom-aligned, clipped to block shape. */
export const GUIDE_CHORD_TONE_UNDERLINE_PX = 2;

/** TASK-2.12 — chromatic de-emphasis when guides are on. */
export const GUIDE_CHROMATIC_DIM_RGBA = 'rgba(0,0,0,0.15)';

function parseFillRgb(color: string): { r: number; g: number; b: number } {
  if (color.startsWith('#')) {
    const h = color.replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  }
  return { r: 128, g: 128, b: 128 };
}

/**
 * ~10% luminance boost vs the same fill used by {@link drawNoteBlocks} (blend toward white).
 * Keeps the strip below the degree label so numerals stay unobscured.
 */
export function brightenNoteBlockFill(fill: string, amount = 0.1): string {
  const { r, g, b } = parseFillRgb(fill);
  const t = amount;
  const rr = Math.round(r + (255 - r) * t);
  const gg = Math.round(g + (255 - g) * t);
  const bb = Math.round(b + (255 - b) * t);
  return `rgb(${rr},${gg},${bb})`;
}

/**
 * Active chord for a note: last chord in the same measure with `beat <= noteBeat`;
 * else the last chord (by beat) in an earlier measure, scanning back up to 4 measures.
 */
export function resolveActiveChordForNote(
  song: SongData,
  measureIndex: number,
  noteBeat: number,
): ChordEvent | null {
  const measure = song.measures[measureIndex];
  if (measure?.chords?.length) {
    const sorted = [...measure.chords].sort((a, b) => a.beat - b.beat);
    const atOrBefore = sorted.filter((c) => c.beat <= noteBeat);
    if (atOrBefore.length > 0) {
      return atOrBefore[atOrBefore.length - 1];
    }
  }

  for (let back = 1; back <= 4; back++) {
    const mi = measureIndex - back;
    if (mi < 0) {
      break;
    }
    const prev = song.measures[mi];
    if (!prev?.chords?.length) {
      continue;
    }
    const sorted = [...prev.chords].sort((a, b) => a.beat - b.beat);
    return sorted[sorted.length - 1];
  }

  return null;
}

function drawChordToneHighlight(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  fillColor: string,
): void {
  const hi = brightenNoteBlockFill(fillColor, 0.1);
  ctx.save();
  beginRoundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, NOTE_BLOCK_CORNER_RADIUS);
  ctx.clip();
  ctx.fillStyle = hi;
  const stripH = Math.min(GUIDE_CHORD_TONE_UNDERLINE_PX, rect.height);
  ctx.fillRect(rect.x, rect.y + rect.height - stripH, rect.width, stripH);
  ctx.restore();
}

function drawChromaticDim(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; width: number; height: number }): void {
  ctx.save();
  beginRoundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, NOTE_BLOCK_CORNER_RADIUS);
  ctx.clip();
  ctx.fillStyle = GUIDE_CHROMATIC_DIM_RGBA;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

/**
 * Second pass after {@link drawNoteBlocks}: guide-tone highlights for visible measures.
 * Pure Canvas2D — no React. Call only when `showGuides` is true (EditorCanvas) so there is no cost when off.
 */
export function drawGuideOverlay(
  ctx: CanvasRenderingContext2D,
  song: SongData,
  viewport: Viewport,
  colorScheme: 'diatonic' | 'major',
): void {
  const start = viewport.startMeasure;
  const end = Math.min(start + viewport.measureCount, song.measures.length);
  const voices: readonly (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];

  ctx.save();

  for (let m = start; m < end; m++) {
    const measure = song.measures[m];
    if (!measure) {
      continue;
    }
    const { key, scale } = getKeyScaleAtMeasure(song, m);

    for (const v of voices) {
      const list = measure.notes[v] ?? [];
      for (const note of list) {
        if (note.isRest) {
          continue;
        }

        const chord = resolveActiveChordForNote(song, m, note.beat);
        if (!chord) {
          continue;
        }

        const compat = theoryEngine.getGuideCompatibility(note.scaleDegree, note.chromatic, chord, scale);
        if (compat === 'scale-tone') {
          continue;
        }

        const rect = computeNoteBlockRect({
          song,
          viewport,
          measureIndex: m,
          note,
          isRest: false,
        });

        const baseFill = noteBlockFillColor(note, key, scale, colorScheme);

        if (compat === 'chord-tone') {
          drawChordToneHighlight(ctx, rect, baseFill);
        } else {
          drawChromaticDim(ctx, rect);
        }
      }
    }
  }

  ctx.restore();
}
