import type { ChordEvent, NoteName, ScaleDegree, ScaleType, SongData, Viewport } from '@vybpad/shared';

import type { EditorLabelMode } from '../../types/editorChrome';
import type { TheoryEngine } from '../theory/theoryEngine';
import { noteNameToMidiBase } from '../theory/noteNames';
import { resolveSecondaryTarget } from '../theory/secondaryChords';
import { scaleDegreeToMidi } from '../theory/scaleDegreeToMidi';
import { CHORD_AREA_HEIGHT, CHORD_LETTER_STRIP_HEIGHT, NOTE_HEIGHT } from './constants';
import { pat010DiatonicHex, pat010MajorCentricHex, PAT010_DIATONIC_DEGREE_HEX } from './colorMaps';
import {
  absoluteTickFromMeasurePosition,
  absoluteTickToViewportX,
  CHORD_STRIP_TOTAL_HEIGHT,
  bottomChordStripTopY,
  getKeyAtMeasure,
  getScaleAtMeasure,
  pixelsPerTick,
} from './layout';

/** UX §6 — Hookpad-like rounded chord strips. */
export const CHORD_BLOCK_CORNER_RADIUS = 6;

/** UX §6 — 1px stroke at ~12% black. */
export const CHORD_BLOCK_BORDER = 'rgba(0, 0, 0, 0.12)';

/** Inner tonic rails (top/bottom) for each chord block. */
export const CHORD_TONIC_RAIL_HEIGHT = 4;

/** Same as {@link PAT010_DIATONIC_DEGREE_HEX} — exported under this name for existing tests. */
export const PAT010_DEGREE_HEX = PAT010_DIATONIC_DEGREE_HEX;

/** UX §6 — fill is PAT-010 at ≤20% over white (low-opacity wash). */
export const CHORD_FILL_BLEND_ALPHA = 0.2;

export type ChordColorScheme = 'diatonic' | 'major';

const IONIAN_PC_FROM_TONIC = [0, 2, 4, 5, 7, 9, 11] as const;

const DARK_LABEL = '#111827';
const LIGHT_LABEL = '#FFFFFF';

function clampDegree(d: number): ScaleDegree {
  const x = Math.max(1, Math.min(7, Math.round(d)));
  return x as ScaleDegree;
}

/**
 * Ionian tonic PC used for PAT-010 “major-centric” mapping: natural minor → relative major;
 * other modes → parallel Ionian on the same key letter.
 */
export function ionianTonicPcForMajorCentric(key: NoteName, scale: ScaleType): number {
  const kp = noteNameToMidiBase(key) % 12;
  if (scale === 'minor' || scale === 'harmonicMinor') {
    return (kp + 3) % 12;
  }
  return kp;
}

/** Root pitch class (0–11) for coloring / analysis — matches secondary + borrowed spelling used in playback. */
export function chordRootPitchClass(chord: ChordEvent, key: NoteName, scale: ScaleType): number {
  if (chord.secondary) {
    const { targetKey, targetScale } = resolveSecondaryTarget(chord.secondary, key, scale);
    const rootMidi = scaleDegreeToMidi(chord.scaleDegree, 0, 0, targetKey, targetScale, 4);
    return ((rootMidi % 12) + 12) % 12;
  }
  const modeForRoot = chord.borrowed ?? scale;
  return scaleDegreeToMidi(chord.scaleDegree, 0, 0, key, modeForRoot, 4) % 12;
}

function degreeFromRootInIonianMajor(rootPc: number, ionianTonicPc: number): ScaleDegree | null {
  const diff = (rootPc - ionianTonicPc + 12) % 12;
  for (let i = 0; i < 7; i++) {
    if (IONIAN_PC_FROM_TONIC[i] === diff) {
      return (i + 1) as ScaleDegree;
    }
  }
  return null;
}

/**
 * Effective PAT-010 degree index (1–7) for hue lookup.
 * - `diatonic`: Roman scale degree in the home mode (including borrowed/secondary metadata on the event).
 * - `major`: root pitch class vs Ionian on {@link ionianTonicPcForMajorCentric}, else falls back to stored scale degree.
 */
export function effectiveDegreeForChordColor(
  chord: ChordEvent,
  key: NoteName,
  scale: ScaleType,
  colorScheme: ChordColorScheme,
): ScaleDegree {
  if (colorScheme === 'diatonic') {
    return chord.scaleDegree;
  }
  const rootPc = chordRootPitchClass(chord, key, scale);
  const ionianTonic = ionianTonicPcForMajorCentric(key, scale);
  const mapped = degreeFromRootInIonianMajor(rootPc, ionianTonic);
  return mapped ?? chord.scaleDegree;
}

export function pat010HexForDegree(degree: ScaleDegree): string {
  return pat010DiatonicHex(degree);
}

export function blendPat010Fill(hex: string, alpha: number = CHORD_FILL_BLEND_ALPHA): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const br = Math.round(255 * (1 - alpha) + r * alpha);
  const bg = Math.round(255 * (1 - alpha) + g * alpha);
  const bb = Math.round(255 * (1 - alpha) + b * alpha);
  return `rgb(${br},${bg},${bb})`;
}

function channelFromCssColor(s: string): [number, number, number] {
  if (s.startsWith('rgb(')) {
    const inner = s.slice(4, -1).split(',');
    return [parseInt(inner[0].trim(), 10), parseInt(inner[1].trim(), 10), parseInt(inner[2].trim(), 10)];
  }
  if (s.startsWith('#') && s.length === 7) {
    return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  }
  return [255, 255, 255];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(lum1: number, lum2: number): number {
  const L1 = Math.max(lum1, lum2);
  const L2 = Math.min(lum1, lum2);
  return (L1 + 0.05) / (L2 + 0.05);
}

/**
 * Returns label color and whether to draw a subtle shadow (UX §6 / §2 canvas contrast rule).
 */
export function chordBlockTextStyle(fillRgb: string, preferredDark: string = DARK_LABEL): {
  fill: string;
  shadow: boolean;
} {
  const [r, g, b] = channelFromCssColor(fillRgb);
  const bgLum = relativeLuminance(r, g, b);
  const dark = channelFromCssColor(preferredDark);
  const darkLum = relativeLuminance(dark[0], dark[1], dark[2]);
  if (contrastRatio(bgLum, darkLum) >= 4.5) {
    return { fill: preferredDark, shadow: false };
  }
  return { fill: LIGHT_LABEL, shadow: true };
}

export interface ChordBlockRect {
  measureIndex: number;
  chord: ChordEvent;
  x: number;
  y: number;
  width: number;
  height: number;
  absoluteTick: number;
}

/**
 * Layout for one chord block: width = duration × pixelsPerTick(zoom); height = roman band plus label strip
 * (the total of {@link CHORD_AREA_HEIGHT} and {@link CHORD_LETTER_STRIP_HEIGHT}).
 * X from {@link absoluteTickToViewportX}; Y = {@link bottomChordStripTopY} (RA-2 bottom strip).
 */
export function layoutChordBlock(
  chord: ChordEvent,
  measureIndex: number,
  song: SongData,
  viewport: Viewport,
  melodyRowHeight: number = NOTE_HEIGHT,
): ChordBlockRect {
  const absoluteTick = absoluteTickFromMeasurePosition(song, measureIndex, chord.beat);
  const x = absoluteTickToViewportX(absoluteTick, viewport, song);
  const w = chord.duration * pixelsPerTick(viewport.zoom);
  return {
    measureIndex,
    chord,
    x,
    y: bottomChordStripTopY(melodyRowHeight),
    width: w,
    height: CHORD_STRIP_TOTAL_HEIGHT,
    absoluteTick,
  };
}

/**
 * Roman line is authoritative for figured / quality (theoryEngine). Absolute chord name supplements
 * slash spelling and letter names when a second line fits (UX §2 Roman + small hint).
 */
export function chordBlockLabelLines(
  chord: ChordEvent,
  key: NoteName,
  scale: ScaleType,
  theory: Pick<TheoryEngine, 'toRomanNumeral' | 'toChordName'>,
): { romanLine: string; absoluteLine: string } {
  return {
    romanLine: theory.toRomanNumeral(chord, scale),
    absoluteLine: theory.toChordName(chord, key, scale),
  };
}

export interface DrawChordBlocksOptions {
  colorScheme?: ChordColorScheme;
  /** When false, suppress the secondary chord-name line under Roman/degree labels. */
  showAbsoluteChordName?: boolean;
  /** INTERFACES.md EditorSettingsPanel — how chord blocks are labeled. */
  labelMode?: EditorLabelMode;
  /** Melody row height from staff spacing; must match `computeNoteBlockRect` / EditorCanvas. */
  melodyRowHeight?: number;
}

/**
 * Draws rounded chord blocks for all chords in the viewport’s visible measures.
 * Pure Canvas2D — no React.
 */
export function drawChordBlocks(
  ctx: CanvasRenderingContext2D,
  song: SongData,
  viewport: Viewport,
  theory: TheoryEngine,
  options?: DrawChordBlocksOptions,
): void {
  const colorScheme = options?.colorScheme ?? 'diatonic';
  const labelMode: EditorLabelMode = options?.labelMode ?? 'degree';
  const melodyRowHeight = options?.melodyRowHeight ?? NOTE_HEIGHT;
  const start = viewport.startMeasure;
  const end = Math.min(start + viewport.measureCount, song.measures.length);

  for (let mi = start; mi < end; mi++) {
    const measure = song.measures[mi];
    const key = getKeyAtMeasure(song, mi);
    const scale = getScaleAtMeasure(song, mi);

    for (const chord of measure.chords) {
      const rect = layoutChordBlock(chord, mi, song, viewport, melodyRowHeight);
      if (rect.width <= 0) {
        continue;
      }

      const rootPc = chordRootPitchClass(chord, key, scale);
      const ionianTonic = ionianTonicPcForMajorCentric(key, scale);
      const degree = effectiveDegreeForChordColor(chord, key, scale, colorScheme);
      const baseHex =
        colorScheme === 'diatonic'
          ? pat010DiatonicHex(clampDegree(degree))
          : pat010MajorCentricHex(rootPc - ionianTonic);
      const fill = blendPat010Fill(baseHex, CHORD_FILL_BLEND_ALPHA);

      const { x, y, width: w, height: h } = rect;
      const { romanLine, absoluteLine } = chordBlockLabelLines(chord, key, scale, theory);
      const degreeLine = String(chord.scaleDegree);
      const wantAbsoluteLine = options?.showAbsoluteChordName !== false;

      if (labelMode === 'off') {
        continue;
      }

      const romanBandHeight = CHORD_AREA_HEIGHT;
      const interiorRailHeight = Math.max(1, romanBandHeight - CHORD_TONIC_RAIL_HEIGHT * 2);
      const primaryStyle = chordBlockTextStyle(fill, DARK_LABEL);
      const primaryFont = labelMode === 'degree' ? '700 20px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : '700 22px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const primaryText = labelMode === 'degree' ? degreeLine : romanLine;
      const primaryBaselineY = y + CHORD_TONIC_RAIL_HEIGHT + interiorRailHeight / 2;
      const showSecondaryLine = wantAbsoluteLine && (labelMode === 'roman' || labelMode === 'both') && absoluteLine.length > 0;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, CHORD_BLOCK_CORNER_RADIUS);
      if (typeof ctx.clip === 'function') {
        ctx.clip();
      }

      const railColor = baseHex;
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = railColor;
      ctx.fillRect(x + 1, y + 1, w - 2, CHORD_TONIC_RAIL_HEIGHT);
      ctx.fillRect(x + 1, y + h - CHORD_TONIC_RAIL_HEIGHT - 1, w - 2, CHORD_TONIC_RAIL_HEIGHT);
      ctx.fillStyle = fill;
      ctx.strokeStyle = CHORD_BLOCK_BORDER;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = primaryFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = primaryStyle.fill;

      if (primaryStyle.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        ctx.shadowBlur = 2;
      }

      if (labelMode === 'both' || labelMode === 'roman') {
        ctx.fillText(romanLine, x + w / 2, primaryBaselineY);
      } else {
        ctx.fillText(primaryText, x + w / 2, y + h / 2);
      }

      if (showSecondaryLine) {
        ctx.shadowBlur = 0;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#4B5563';
        ctx.font = '400 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(absoluteLine, x + w / 2, y + CHORD_AREA_HEIGHT + CHORD_LETTER_STRIP_HEIGHT / 2);
      }

      ctx.restore();
    }
  }
}
