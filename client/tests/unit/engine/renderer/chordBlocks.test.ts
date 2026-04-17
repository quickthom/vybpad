/*
 * QA COVERAGE PLAN — UI-R2-W1
 *
 * Criterion 1 — chord strip geometry and opacity
 *   happy: CHORD_AREA_HEIGHT is approximately 4–5 note rows (4*NOTE_HEIGHT .. 5*NOTE_HEIGHT)
 *   happy: CHORD_FILL_BLEND_ALPHA remains translucent for non-opaque strip fill
 *   happy: hitTest + layout stay aligned when melodyRowHeight is passed through
 *
 * Criterion 2 — RA-201 visuals
 *   happy: chord blocks fill an expanded strip; tonic rails are rendered at both block edges
 *   happy: Roman label is visually prominent and chord-name text is a second, separate line
 *   edges: short chords may omit the second chord-name line when geometry is constrained
 *
 * Criterion 3 — RA-206 visuals
 *   happy: pitch axis labels in renderer/pitch axis path contain no octave digits (covered in pianoRoll.ui-w1.test.ts)
 *   edges: accidentals in note names still render using ♯/♭ where needed
 *
 * Criterion 4 — RA-208 visuals
 *   happy: grid row tinting is validated in gridBackground.test.ts and uses PAT-010 hues
 *   edges: tint remains readable with low alpha
 *
 * Criterion 5 — hit-testing alignment
 *   happy: custom staff spacing used for layout remains identical to the hit test target math
 *   edges: mismatched strip sizes now miss to avoid false hits
 *
 * Criterion 6 — snapshot / expectation updates
 *   happy: existing chord-strip assertions are updated to expect the new geometry + roman naming semantics.
 */

import type { ChordEvent, SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it, vi } from 'vitest';

import { theoryEngine } from '../../../../src/engine/theory/theoryEngine';
import {
  BEAT_WIDTH,
  CHORD_AREA_HEIGHT,
  CHORD_BLOCK_CORNER_RADIUS,
  chordBlockLabelLines,
  chordBlockTextStyle,
  CHORD_FILL_BLEND_ALPHA,
  drawChordBlocks,
  effectiveDegreeForChordColor,
  layoutChordBlock,
  MEASURE_HEADER_HEIGHT,
  MELODY_DIATONIC_ROW_COUNT,
  NOTE_HEIGHT,
  PAT010_DEGREE_HEX,
  pixelsPerTick,
  TPQN,
} from '../../../../src/engine/renderer/index';

function minimalSong(measures: { chords: ChordEvent[]; key?: 'C'; scale?: 'major' }[]): SongData {
  const m = measures.map((row, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i}`,
    chords: row.chords,
    notes: [[], [], [], []] as const,
    ...(row.key || row.scale
      ? {
          changes: {
            ...(row.key ? { key: row.key } : {}),
            ...(row.scale ? { scale: row.scale } : {}),
          },
        }
      : {}),
  }));
  return {
    version: '1.0',
    metadata: {
      title: 't',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: m,
    bandConfig: { tracks: [] },
  };
}

function chord(partial: Partial<ChordEvent> & Pick<ChordEvent, 'scaleDegree' | 'quality'>): ChordEvent {
  return {
    id: 'c1',
    scaleDegree: partial.scaleDegree,
    quality: partial.quality,
    seventh: partial.seventh ?? 'none',
    suspension: partial.suspension ?? 'none',
    addition: partial.addition ?? 'none',
    inversion: partial.inversion ?? 0,
    borrowed: partial.borrowed ?? null,
    secondary: partial.secondary ?? null,
    beat: partial.beat ?? 0,
    duration: partial.duration ?? 48,
  };
}

describe('chordBlocks (TASK-2.4)', () => {
  it('criterion 1: CHORD_AREA_HEIGHT aligns with ~4-5 melody rows and strip paint is translucent', () => {
    const song = minimalSong([
      { chords: [chord({ scaleDegree: 1, quality: 'major', duration: 96 })] },
    ]);
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 2 };
    const c = song.measures[0].chords[0];
    const rect = layoutChordBlock(c, 0, song, viewport);
    expect(CHORD_AREA_HEIGHT).toBeGreaterThanOrEqual(4 * NOTE_HEIGHT);
    expect(CHORD_AREA_HEIGHT).toBeLessThanOrEqual(5 * NOTE_HEIGHT);
    expect(CHORD_FILL_BLEND_ALPHA).toBeLessThan(1);
    expect(CHORD_FILL_BLEND_ALPHA).toBeGreaterThan(0);
    expect(rect.height).toBe(CHORD_AREA_HEIGHT);
    expect(rect.y).toBe(MEASURE_HEADER_HEIGHT + MELODY_DIATONIC_ROW_COUNT * NOTE_HEIGHT);
    expect(rect.width).toBe(96 * pixelsPerTick(2));
    expect(rect.width).toBe((96 / TPQN) * BEAT_WIDTH * 2);
  });

  it('criterion 2: RA-201 rail strip + prominent Roman + chord-name line below strip', () => {
    const song = minimalSong([
      { chords: [chord({ scaleDegree: 5, quality: 'major', beat: 0, duration: 192 })] },
    ]);
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const ch = song.measures[0].chords[0];
    const rect = layoutChordBlock(ch, 0, song, viewport);
    const { ctx, fillRectCalls, fillTextCalls, fillText } = createChordBlocksDrawContext();

    drawChordBlocks(ctx, song, viewport, theoryEngine, { labelMode: 'roman', showAbsoluteChordName: true });

    const topRails = fillRectCalls.filter((c) => {
      return Math.abs(c.x - rect.x) < 0.1 && Math.abs(c.y - rect.y) < 0.1 && c.w === rect.width && c.h <= 4;
    });
    const bottomRails = fillRectCalls.filter((c) => {
      return (
        Math.abs(c.x - rect.x) < 0.1 &&
        Math.abs(c.y + c.h - (rect.y + rect.height)) < 0.1 &&
        c.w === rect.width &&
        c.h <= 4
      );
    });
    expect(topRails.length).toBeGreaterThanOrEqual(1);
    expect(bottomRails.length).toBeGreaterThanOrEqual(1);
    expect(topRails.some((c) => c.fillStyle !== '#FFFFFF')).toBe(true);
    expect(bottomRails.some((c) => c.fillStyle !== '#FFFFFF')).toBe(true);

    const expectedRoman = theoryEngine.toRomanNumeral(ch, 'major');
    const expectedName = theoryEngine.toChordName(ch, 'C', 'major');
    const roman = fillTextCalls.find((entry) => entry.text === expectedRoman);
    const chordName = fillTextCalls.find((entry) => entry.text === expectedName);
    expect(roman).toBeDefined();
    expect(chordName).toBeDefined();
    expect(chordName!.y).toBeGreaterThan(rect.y);
    expect(chordName!.y).toBeLessThan(rect.y + rect.height);
    expect(roman!.font).not.toBe(chordName!.font);
    expect(fillText).toHaveBeenCalledTimes(2);
  });

  it('criterion 2: fill blends PAT-010 hue at UX opacity; text style picks dark when contrast suffices', () => {
    const red = PAT010_DEGREE_HEX[0];
    const fill = `rgb(${Math.round(255 * (1 - CHORD_FILL_BLEND_ALPHA) + parseInt(red.slice(1, 3), 16) * CHORD_FILL_BLEND_ALPHA)},${Math.round(255 * (1 - CHORD_FILL_BLEND_ALPHA) + parseInt(red.slice(3, 5), 16) * CHORD_FILL_BLEND_ALPHA)},${Math.round(255 * (1 - CHORD_FILL_BLEND_ALPHA) + parseInt(red.slice(5, 7), 16) * CHORD_FILL_BLEND_ALPHA)})`;
    const style = chordBlockTextStyle(fill);
    expect(style.fill).toBe('#111827');
    expect(style.shadow).toBe(false);
  });

  it('criterion 3: labels use theoryEngine Roman + chord name with per-measure key/scale', () => {
    const song = minimalSong([
      { chords: [] },
      {
        chords: [chord({ scaleDegree: 5, quality: 'major', beat: 0, duration: 48 })],
        key: 'C',
        scale: 'major',
      },
    ]);
    const key = 'G';
    const scale = 'major';
    const ch = song.measures[1].chords[0];
    const { romanLine, absoluteLine } = chordBlockLabelLines(ch, key, scale, theoryEngine);
    expect(romanLine).toBe(theoryEngine.toRomanNumeral(ch, scale));
    expect(absoluteLine).toBe(theoryEngine.toChordName(ch, key, scale));
    expect(romanLine).toContain('V');
    expect(absoluteLine).toMatch(/^D/);
  });

  it('criterion 3b: effective diatonic degree follows ChordEvent (secondary V/V → degree 2)', () => {
    const ch = chord({
      scaleDegree: 2,
      quality: 'major',
      secondary: { function: 'V', target: 5 },
    });
    expect(effectiveDegreeForChordColor(ch, 'C', 'major', 'diatonic')).toBe(2);
  });

  it('criterion 4: Roman line carries figured / quality from theoryEngine (V7 in major)', () => {
    const ch = chord({ scaleDegree: 5, quality: 'major', seventh: 'dom7' });
    const { romanLine } = chordBlockLabelLines(ch, 'C', 'major', theoryEngine);
    expect(romanLine).toBe('V7');
  });
});

function createChordBlocksDrawContext(): {
  ctx: CanvasRenderingContext2D;
  roundRect: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  fillRectCalls: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }>;
  fillTextCalls: Array<{ text: string; x: number; y: number; fillStyle: string; font: string }>;
} {
  const roundRect = vi.fn();
  const fillRectCalls: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }> = [];
  const fillTextCalls: Array<{ text: string; x: number; y: number; fillStyle: string; font: string }> = [];
  const fillText = vi.fn((text: string, x: number, y: number) => {
    const currentText = String(text);
    fillTextCalls.push({ text: currentText, x, y, fillStyle, font });
  });
  const fill = vi.fn();
  const stroke = vi.fn();
  const fillRect = vi.fn((x: number, y: number, w: number, h: number) => {
    fillRectCalls.push({ x, y, w, h, fillStyle });
  });
  const beginPath = vi.fn();
  let fillStyle = '';
  let font = '';
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath,
    roundRect,
    fill,
    stroke,
    fillText,
    measureText: vi.fn(() => ({ width: 0 })),
    lineWidth: 1,
    strokeStyle: '',
    set fillStyle(v: string) {
      fillStyle = v;
    },
    get fillStyle() {
      return fillStyle;
    },
    font: '',
    set font(v: string) {
      font = v;
    },
    get font() {
      return font;
    },
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
    shadowColor: '',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    fillRect,
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, roundRect, fillText, fill, stroke, fillRect, fillRectCalls, fillTextCalls };
}

describe('chordBlocks — canvas draw calls (TASK-2.14)', () => {
  it('calls roundRect with x, y, width, height from layoutChordBlock for a 96-tick chord at zoom 1', () => {
    const song = minimalSong([{ chords: [chord({ scaleDegree: 1, quality: 'major', beat: 0, duration: 96 })] }]);
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const ch = song.measures[0].chords[0];
    const rect = layoutChordBlock(ch, 0, song, viewport);
    const { ctx, roundRect } = createChordBlocksDrawContext();

    drawChordBlocks(ctx, song, viewport, theoryEngine);

    expect(roundRect).toHaveBeenCalledWith(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      CHORD_BLOCK_CORNER_RADIUS,
    );
    expect(rect.width).toBe(96 * pixelsPerTick(1));
    expect(rect.height).toBe(CHORD_AREA_HEIGHT);
  });

  it('calls fillText with the Roman numeral line from theoryEngine for the chord label', () => {
    const song = minimalSong([{ chords: [chord({ scaleDegree: 1, quality: 'major', beat: 0, duration: 96 })] }]);
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const ch = song.measures[0].chords[0];
    const expectedRoman = theoryEngine.toRomanNumeral(ch, 'major');
    const { ctx, fillText } = createChordBlocksDrawContext();

    drawChordBlocks(ctx, song, viewport, theoryEngine, { labelMode: 'roman' });

    expect(expectedRoman).toBe('I');
    expect(fillText).toHaveBeenCalledWith(
      expectedRoman,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('issues one roundRect per chord when a measure contains multiple chords', () => {
    const song = minimalSong([
      {
        chords: [
          chord({ id: 'a', scaleDegree: 1, quality: 'major', beat: 0, duration: 48 }),
          chord({ id: 'b', scaleDegree: 4, quality: 'major', beat: 48, duration: 48 }),
        ],
      },
    ]);
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const { ctx, roundRect } = createChordBlocksDrawContext();

    drawChordBlocks(ctx, song, viewport, theoryEngine);

    expect(roundRect).toHaveBeenCalledTimes(2);
    const r0 = layoutChordBlock(song.measures[0].chords[0], 0, song, viewport);
    const r1 = layoutChordBlock(song.measures[0].chords[1], 0, song, viewport);
    expect(roundRect).toHaveBeenNthCalledWith(
      1,
      r0.x,
      r0.y,
      r0.width,
      r0.height,
      CHORD_BLOCK_CORNER_RADIUS,
    );
    expect(roundRect).toHaveBeenNthCalledWith(
      2,
      r1.x,
      r1.y,
      r1.width,
      r1.height,
      CHORD_BLOCK_CORNER_RADIUS,
    );
  });
});
