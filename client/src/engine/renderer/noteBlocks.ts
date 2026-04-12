import type { NoteEvent, NoteName, ScaleDegree, ScaleType, SongData, Viewport } from '@vybpad/shared';

import { NOTE_HEIGHT } from './constants';
import {
  absoluteTickFromMeasurePosition,
  absoluteTickToViewportX,
  noteRowYFromNoteEvent,
  noteRowY,
  pixelsPerTick,
} from './layout';
import { noteNameToMidiBase } from '../theory/noteNames';
import { scaleDegreeToMidi } from '../theory/scaleDegreeToMidi';

/** UX §6 — inset inside the NOTE_HEIGHT row. */
export const NOTE_BLOCK_VERTICAL_INSET = 1;

/** UX §6 — rounded note blocks use 4px corner radius. */
export const NOTE_BLOCK_CORNER_RADIUS = 4;

/** UX §6 — border #1F2937 @ 35% opacity. */
export const NOTE_BLOCK_BORDER_STYLE = 'rgba(31, 41, 55, 0.35)';

/** UX §6 — octave digit beside degree numeral. */
export const NOTE_OCTAVE_LABEL_COLOR = '#4B5563';

/** PAT-010 diatonic degree fills (1–7). */
export const DEGREE_FILL_HEX: Record<ScaleDegree, string> = {
  1: '#E74C3C',
  2: '#E67E22',
  3: '#F1C40F',
  4: '#2ECC71',
  5: '#1ABC9C',
  6: '#3498DB',
  7: '#9B59B6',
};

const MAJOR_SCALE_REL_TO_TONIC: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

const SCALE_DEGREES: readonly ScaleDegree[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Key + scale in effect at the start of `measureIndex`, inheriting `MeasureChanges` like {@link getMeterAtMeasure}.
 */
export function getKeyScaleAtMeasure(
  song: SongData,
  measureIndex: number,
): { key: NoteName; scale: ScaleType } {
  let key = song.metadata.key;
  let scale = song.metadata.scale;
  const n = Math.min(measureIndex, song.measures.length - 1);
  for (let j = 0; j <= n; j++) {
    const c = song.measures[j]?.changes;
    if (c?.key) {
      key = c.key;
    }
    if (c?.scale) {
      scale = c.scale;
    }
  }
  return { key, scale };
}

/**
 * PAT-010 major-centric: natural / harmonic minor roots are colored against the **relative major** tonic;
 * other modes use the **parallel major** (Ionian on the same key center).
 */
export function referenceMajorTonicPitchClass(key: NoteName, scale: ScaleType): number {
  const tonicPc = noteNameToMidiBase(key);
  if (scale === 'minor' || scale === 'harmonicMinor') {
    return (tonicPc + 3) % 12;
  }
  return tonicPc;
}

/**
 * Maps a pitch class to the nearest major-scale degree (1–7) for PAT-010 major-centric hue selection.
 */
export function pitchClassToNearestMajorScaleDegree(pitchClass: number, majorTonicPc: number): ScaleDegree {
  const rel = (pitchClass - majorTonicPc + 12) % 12;
  const idx = MAJOR_SCALE_REL_TO_TONIC.indexOf(rel);
  if (idx >= 0) {
    return SCALE_DEGREES[idx] ?? 1;
  }
  let best: ScaleDegree = 1;
  let bestDist = 12;
  for (let d = 0; d < 7; d++) {
    const target = MAJOR_SCALE_REL_TO_TONIC[d] ?? 0;
    const dist = Math.min(Math.abs(rel - target), 12 - Math.abs(rel - target));
    if (dist < bestDist) {
      bestDist = dist;
      best = SCALE_DEGREES[d] ?? best;
    }
  }
  return best;
}

/** Effective PAT-010 hue index (1–7) for a note event, before chromatic muting. */
export function effectiveDegreeForColor(
  note: NoteEvent,
  key: NoteName,
  scale: ScaleType,
  colorScheme: 'diatonic' | 'major',
): ScaleDegree {
  if (colorScheme === 'diatonic') {
    return note.scaleDegree;
  }
  const midi = scaleDegreeToMidi(note.scaleDegree, note.octave, note.chromatic, key, scale, 4);
  const pc = ((midi % 12) + 12) % 12;
  const ref = referenceMajorTonicPitchClass(key, scale);
  return pitchClassToNearestMajorScaleDegree(pc, ref);
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function parseCssRgb(color: string): { r: number; g: number; b: number } {
  if (color.startsWith('#')) {
    return parseHex(color);
  }
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  }
  return { r: 128, g: 128, b: 128 };
}

/** UX §6 / PAT-010: degree fill blended toward white (~85% opacity over white). */
export function blendDegreeFillWithWhite(hex: string): string {
  const { r, g, b } = parseHex(hex);
  const t = 0.85;
  const wr = Math.round(255 * (1 - t) + r * t);
  const wg = Math.round(255 * (1 - t) + g * t);
  const wb = Math.round(255 * (1 - t) + b * t);
  return `rgb(${wr},${wg},${wb})`;
}

/** PAT-010 / PAT-017: muted fill for chromatic alterations. */
export function muteChromaticFill(saturatedRgb: string): string {
  const { r, g, b } = parseHex(saturatedRgb);
  const gray = 0x9ca3af;
  const t = 0.45;
  const mr = Math.round(r * (1 - t) + ((gray >> 16) & 0xff) * t);
  const mg = Math.round(g * (1 - t) + ((gray >> 8) & 0xff) * t);
  const mb = Math.round(b * (1 - t) + (gray & 0xff) * t);
  return `rgb(${mr},${mg},${mb})`;
}

/**
 * Final fill color for a note block (diatonic / major scheme, chromatic muting, white blend).
 */
export function noteBlockFillColor(
  note: NoteEvent,
  key: NoteName,
  scale: ScaleType,
  colorScheme: 'diatonic' | 'major',
): string {
  const deg = effectiveDegreeForColor(note, key, scale, colorScheme);
  const baseHex = DEGREE_FILL_HEX[deg];
  const blended = blendDegreeFillWithWhite(baseHex);
  if (note.chromatic !== 0) {
    // Re-extract rough hex from rgb for muting helper — keep midpoint saturation drop
    const m = blended.match(/rgb\((\d+),(\d+),(\d+)\)/);
    if (m) {
      const rr = Number(m[1]).toString(16).padStart(2, '0');
      const gg = Number(m[2]).toString(16).padStart(2, '0');
      const bb = Number(m[3]).toString(16).padStart(2, '0');
      return muteChromaticFill(`#${rr}${gg}${bb}`);
    }
  }
  return blended;
}

/** Per UX §6, rests sit on a stable mid-staff anchor (scale degree 4, octave 0). */
export const REST_VERTICAL_ANCHOR: Pick<NoteEvent, 'scaleDegree' | 'octave' | 'chromatic'> = {
  scaleDegree: 4,
  octave: 0,
  chromatic: 0,
};

function restTopY(scrollY: number): number {
  return noteRowY(REST_VERTICAL_ANCHOR.scaleDegree, REST_VERTICAL_ANCHOR.octave, REST_VERTICAL_ANCHOR.chromatic, scrollY);
}

export interface NoteBlockRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComputeNoteBlockRectParams {
  song: SongData;
  viewport: Viewport;
  measureIndex: number;
  note: NoteEvent;
  /** When true, vertical position follows {@link REST_VERTICAL_ANCHOR} instead of pitch. */
  isRest: boolean;
}

/**
 * Pure geometry for a single note/rest block in **viewport coordinates** (same space as {@link absoluteTickToViewportX}).
 */
export function computeNoteBlockRect(params: ComputeNoteBlockRectParams): NoteBlockRect {
  const { song, viewport, measureIndex, note, isRest } = params;
  const absTick = absoluteTickFromMeasurePosition(song, measureIndex, note.beat);
  const x = absoluteTickToViewportX(absTick, viewport, song);
  const w = note.duration * pixelsPerTick(viewport.zoom);
  const rowTop = isRest ? restTopY(viewport.scrollY) : noteRowYFromNoteEvent(note, viewport.scrollY);
  const y = rowTop + NOTE_BLOCK_VERTICAL_INSET;
  const height = NOTE_HEIGHT - 2 * NOTE_BLOCK_VERTICAL_INSET;
  return { x, y, width: w, height };
}

export interface DegreeLabelParts {
  /** ♭ or ♯ prefix for PAT-018, or empty. */
  accidentalPrefix: string;
  /** Arabic scale degree 1–7. */
  degreeNumeral: string;
  /** "+1" / "-1" style octave hint, or null when octave === 0 or rest. */
  octaveIndicator: string | null;
}

export function formatDegreeLabelParts(note: NoteEvent): DegreeLabelParts {
  if (note.isRest) {
    return { accidentalPrefix: '', degreeNumeral: '', octaveIndicator: null };
  }
  let accidentalPrefix = '';
  if (note.chromatic < 0) {
    accidentalPrefix = '♭';
  } else if (note.chromatic > 0) {
    accidentalPrefix = '♯';
  }
  const degreeNumeral = String(note.scaleDegree);
  let octaveIndicator: string | null = null;
  if (note.octave !== 0) {
    octaveIndicator = note.octave > 0 ? `+${note.octave}` : `${note.octave}`;
  }
  return { accidentalPrefix, degreeNumeral, octaveIndicator };
}

/** Choose dark or light label for contrast vs fill (UX §2 canvas table). */
export function labelTextStyleForBackground(fillColor: string): { fillStyle: string; useShadow: boolean } {
  const { r, g, b } = parseCssRgb(fillColor);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.62) {
    return { fillStyle: '#111827', useShadow: false };
  }
  return { fillStyle: '#FFFFFF', useShadow: true };
}

/** Rounded rectangle path on `ctx` (uses `roundRect` when available). */
export function beginRoundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rad);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Hatch + fill for rests (UX §6 — hatch or hollow; we use light hatch + hollow tone). */
function fillRestHatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  beginRoundRectPath(ctx, x, y, w, h, NOTE_BLOCK_CORNER_RADIUS);
  ctx.clip();
  ctx.fillStyle = '#F3F4F6';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1;
  const step = 5;
  for (let i = -h; i < w + h; i += step) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
    ctx.stroke();
  }
  ctx.restore();
  beginRoundRectPath(ctx, x, y, w, h, NOTE_BLOCK_CORNER_RADIUS);
  ctx.strokeStyle = '#9CA3AF';
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
}

export interface DrawNoteBlocksOptions {
  /** When set, only this voice index (0–3) is drawn; otherwise all voices. */
  voiceIndex?: 0 | 1 | 2 | 3;
  colorScheme?: 'diatonic' | 'major';
}

/**
 * Canvas pass: note/rest blocks for visible measures. No React — call from the editor render loop.
 * Voices paint in order 0→3; overlapping notes stack with later voices on top.
 */
export function drawNoteBlocks(
  ctx: CanvasRenderingContext2D,
  song: SongData,
  viewport: Viewport,
  options: DrawNoteBlocksOptions = {},
): void {
  const colorScheme = options.colorScheme ?? 'diatonic';
  const start = viewport.startMeasure;
  const end = Math.min(start + viewport.measureCount, song.measures.length);
  const voices: readonly (0 | 1 | 2 | 3)[] =
    options.voiceIndex !== undefined ? [options.voiceIndex] : [0, 1, 2, 3];

  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let m = start; m < end; m++) {
    const measure = song.measures[m];
    if (!measure) {
      continue;
    }
    const { key, scale } = getKeyScaleAtMeasure(song, m);

    for (const v of voices) {
      const list = measure.notes[v] ?? [];
      for (const note of list) {
        const rect = computeNoteBlockRect({
          song,
          viewport,
          measureIndex: m,
          note,
          isRest: note.isRest,
        });
        if (note.isRest) {
          fillRestHatch(ctx, rect.x, rect.y, rect.width, rect.height);
          continue;
        }

        const fill = noteBlockFillColor(note, key, scale, colorScheme);
        ctx.fillStyle = fill;
        beginRoundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, NOTE_BLOCK_CORNER_RADIUS);
        ctx.fill();
        ctx.strokeStyle = NOTE_BLOCK_BORDER_STYLE;
        ctx.setLineDash([]);
        beginRoundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, NOTE_BLOCK_CORNER_RADIUS);
        ctx.stroke();

        const parts = formatDegreeLabelParts(note);
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        const { fillStyle, useShadow } = labelTextStyleForBackground(fill);
        ctx.fillStyle = fillStyle;
        if (useShadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.35)';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 1;
        } else {
          ctx.shadowColor = 'transparent';
        }

        const accWidth = parts.accidentalPrefix
          ? ctx.measureText(parts.accidentalPrefix).width
          : 0;
        const degWidth = ctx.measureText(parts.degreeNumeral).width;
        const half = (accWidth + degWidth) / 2;
        let tx = cx - half;
        if (parts.accidentalPrefix) {
          ctx.fillText(parts.accidentalPrefix, tx + accWidth / 2, cy);
          tx += accWidth;
        }
        ctx.fillText(parts.degreeNumeral, tx + degWidth / 2, cy);

        if (parts.octaveIndicator) {
          ctx.shadowColor = 'transparent';
          ctx.fillStyle = NOTE_OCTAVE_LABEL_COLOR;
          ctx.font = '500 9px ui-sans-serif, system-ui, sans-serif';
          const ox = cx + half + 2;
          const oy = note.octave > 0 ? rect.y + 5 : rect.y + rect.height - 3;
          ctx.textBaseline = note.octave > 0 ? 'top' : 'bottom';
          ctx.fillText(parts.octaveIndicator, ox, oy);
          ctx.textBaseline = 'middle';
          ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
        }
        ctx.shadowColor = 'transparent';
        ctx.shadowOffsetY = 0;
      }
    }
  }
  ctx.restore();
}
