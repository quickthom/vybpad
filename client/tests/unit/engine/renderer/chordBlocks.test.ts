import type { ChordEvent, SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it, vi } from 'vitest';

import { theoryEngine } from '../../../../src/engine/theory/theoryEngine';
import {
  BEAT_WIDTH,
  CHORD_AREA_HEIGHT,
  CHORD_BLOCK_CORNER_RADIUS,
  CHORD_BLOCK_BORDER,
  chordBlockLabelLines,
  chordBlockTextStyle,
  CHORD_FILL_BLEND_ALPHA,
  CHORD_LETTER_STRIP_HEIGHT,
  CHORD_TONIC_RAIL_HEIGHT,
  blendPat010Fill,
  drawChordBlocks,
  effectiveDegreeForChordColor,
  layoutChordBlock,
  MEASURE_HEADER_HEIGHT,
  MELODY_DIATONIC_ROW_COUNT,
  NOTE_HEIGHT,
  PAT010_DEGREE_HEX,
  pat010DiatonicHex,
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
  it('criterion 1: block width = duration × pixelsPerTick(zoom); height = CHORD_AREA_HEIGHT + CHORD_LETTER_STRIP_HEIGHT; Y = chord strip', () => {
    const song = minimalSong([
      { chords: [chord({ scaleDegree: 1, quality: 'major', duration: 96 })] },
    ]);
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 2 };
    const c = song.measures[0].chords[0];
    const rect = layoutChordBlock(c, 0, song, viewport);
    expect(rect.height).toBe(CHORD_AREA_HEIGHT + CHORD_LETTER_STRIP_HEIGHT);
    expect(rect.y).toBe(MEASURE_HEADER_HEIGHT + MELODY_DIATONIC_ROW_COUNT * NOTE_HEIGHT);
    expect(rect.width).toBe(96 * pixelsPerTick(2));
    expect(rect.width).toBe((96 / TPQN) * BEAT_WIDTH * 2);
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
  fillRect: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  fillStyleLog: string[];
  fillRectCalls: Array<{ x: number; y: number; w: number; h: number; color: string }>;
  fillTextCalls: Array<{ text: string; x: number; y: number; font: string; color: string }>;
} {
  const roundRect = vi.fn();
  const stroke = vi.fn();
  const beginPath = vi.fn();

  const fillStyleLog: string[] = [];
  const fillRectCalls: Array<{ x: number; y: number; w: number; h: number; color: string }> = [];
  const fillTextCalls: Array<{ text: string; x: number; y: number; font: string; color: string }> = [];

  let fillStyle = '';
  let font = '';
  const fillText = vi.fn((text: string, x: number, y: number) => {
    fillTextCalls.push({ text, x, y, font, color: fillStyle });
  });
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath,
    roundRect,
    clip: vi.fn(),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      fillRectCalls.push({ x, y, w, h, color: fillStyle });
    }),
    stroke,
    fillText,
    measureText: vi.fn(() => ({ width: 0 })),
    lineWidth: 1,
    set strokeStyle(v: string) {
      /* no-op for assertions */
      v; // keep signature for TS
    },
    get strokeStyle() {
      return CHORD_BLOCK_BORDER;
    },
    set fillStyle(v: string) {
      fillStyle = v;
      fillStyleLog.push(v);
    },
    get fillStyle() {
      return fillStyle;
    },
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
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, roundRect, fillText, fillRect: ctx.fillRect, stroke, fillStyleLog, fillRectCalls, fillTextCalls };
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
    expect(rect.height).toBe(CHORD_AREA_HEIGHT + CHORD_LETTER_STRIP_HEIGHT);
  });

  it('calls fillText with the Roman numeral line from theoryEngine for the chord label', () => {
    const song = minimalSong([{ chords: [chord({ scaleDegree: 1, quality: 'major', beat: 0, duration: 96 })] }]);
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const ch = song.measures[0].chords[0];
    const expectedRoman = theoryEngine.toRomanNumeral(ch, 'major');
    const expectedName = theoryEngine.toChordName(ch, 'C', 'major');
    const rect = layoutChordBlock(ch, 0, song, viewport);
    const { ctx, fillTextCalls } = createChordBlocksDrawContext();

    drawChordBlocks(ctx, song, viewport, theoryEngine, { labelMode: 'roman' });

    expect(expectedRoman).toBe('I');
    expect(fillTextCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expectedRoman,
          x: expect.closeTo(rect.x + rect.width / 2, 6),
          y: expect.closeTo(rect.y + CHORD_TONIC_RAIL_HEIGHT + (CHORD_AREA_HEIGHT - CHORD_TONIC_RAIL_HEIGHT * 2) / 2, 6),
          font: expect.stringContaining('700 22px'),
          color: expect.stringMatching(/^#111827$|^#FFFFFF$/),
        }),
      ]),
    );
    expect(fillTextCalls).toContainEqual(
      expect.objectContaining({
        text: expectedName,
        x: expect.closeTo(rect.x + rect.width / 2, 6),
        y: expect.closeTo(rect.y + CHORD_AREA_HEIGHT + CHORD_LETTER_STRIP_HEIGHT / 2, 6),
        font: '400 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#4B5563',
      }),
    );
    expect(fillTextCalls).toHaveLength(2);
  });

  it('draws fill wash and 4px tonic rails in the required colors', () => {
    const song = minimalSong([{ chords: [chord({ scaleDegree: 1, quality: 'major', beat: 0, duration: 96 })] }]);
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const ch = song.measures[0].chords[0];
    const baseHex = pat010DiatonicHex(ch.scaleDegree);
    const expectedFill = blendPat010Fill(baseHex, CHORD_FILL_BLEND_ALPHA);
    const rect = layoutChordBlock(ch, 0, song, viewport);
    const { ctx, fillStyleLog, fillRectCalls } = createChordBlocksDrawContext();

    drawChordBlocks(ctx, song, viewport, theoryEngine, { labelMode: 'degree' });

    expect(fillStyleLog).toContain(expectedFill);
    expect(fillStyleLog).toContain(baseHex);
    expect(fillRectCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          x: rect.x,
          y: rect.y,
          w: rect.width,
          h: rect.height,
          color: expectedFill,
        }),
        expect.objectContaining({
          x: rect.x + 1,
          y: rect.y + 1,
          w: rect.width - 2,
          h: CHORD_TONIC_RAIL_HEIGHT,
          color: baseHex,
        }),
        expect.objectContaining({
          x: rect.x + 1,
          y: rect.y + rect.height - CHORD_TONIC_RAIL_HEIGHT - 1,
          w: rect.width - 2,
          h: CHORD_TONIC_RAIL_HEIGHT,
          color: baseHex,
        }),
      ]),
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
