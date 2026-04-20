/*
 * QA COVERAGE PLAN — TASK-2.14
 *
 * Grid draw-call assertions (PAT-012 / layout helpers):
 *   happy: fillText for measure numbers at labelPad + viewport X and header midline Y; vertical
 *          lines at Math.round(viewportX)+0.5 for bar + quarter-note grid
 *   edges: zoom 0.5 / 1 / 2 scales horizontal positions; 3/4 meter has fewer internal beats
 */

import type { Measure, SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  absoluteTickToViewportX,
  BEAT_WIDTH,
  CHORD_AREA_HEIGHT,
  CHORD_LETTER_STRIP_HEIGHT,
  computeGridBackgroundLayout,
  drawGridBackground,
  MEASURE_HEADER_HEIGHT,
  MEASURE_NUMBER_COLOR,
  MEASURE_NUMBER_FONT,
  NOTE_HEIGHT,
  TPQN,
} from '../../../../src/engine/renderer/index';
import { pat010DiatonicHex } from '../../../../src/engine/renderer/colorMaps';
import { bottomChordStripTopY, MELODY_DIATONIC_ROW_COUNT, noteStaffTopY } from '../../../../src/engine/renderer/layout';

function emptyMeasure(id: string): Measure {
  return { id, chords: [], notes: [[], [], [], []] };
}

function minimalSong44(measureCount: number): SongData {
  const measures: Measure[] = [];
  for (let i = 0; i < measureCount; i++) {
    measures.push(emptyMeasure(`00000000-0000-4000-8000-00000000000${i}`));
  }
  return {
    version: '1.0',
    metadata: {
      title: 't',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures,
    bandConfig: {
      tracks: [],
    },
  };
}

function vp(overrides: Partial<Viewport> = {}): Viewport {
  return {
    startMeasure: 0,
    measureCount: 8,
    scrollY: 0,
    zoom: 1,
    ...overrides,
  };
}

describe('grid background layout (TASK-2.3)', () => {
  it('places bar and grid lines using absoluteTickToViewportX / horizontal tick math (4/4, zoom 1)', () => {
    const song = minimalSong44(2);
    const layout = computeGridBackgroundLayout(song, vp({ measureCount: 2 }));

    // Two 4/4 measures → barlines at song ticks 0, 192, 384
    expect(layout.barLines[0]).toBe(absoluteTickToViewportX(0, vp({ measureCount: 2 }), song));
    expect(layout.barLines[1]).toBe(absoluteTickToViewportX(192, vp({ measureCount: 2 }), song));
    expect(layout.barLines[2]).toBe(absoluteTickToViewportX(384, vp({ measureCount: 2 }), song));

    // Internal quarter-note grid: beats 2–4 in each measure (48, 96, 144 ticks from each downbeat)
    const expectedGridXs: number[] = [];
    for (const startTick of [0, 192]) {
      for (const t of [48, 96, 144]) {
        expectedGridXs.push(absoluteTickToViewportX(startTick + t, vp({ measureCount: 2 }), song));
      }
    }
    expect(layout.gridLines).toEqual(expectedGridXs);
  });

  it('uses stronger bar color after grid color when drawing (mock context order)', () => {
    const song = minimalSong44(1);
    const strokeStyles: string[] = [];
    const ctx = {
      save: () => undefined,
      restore: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => undefined,
      fillText: () => undefined,
      set strokeStyle(v: string) {
        strokeStyles.push(v);
      },
      get strokeStyle() {
        return strokeStyles[strokeStyles.length - 1] ?? '';
      },
      lineWidth: 1,
      fillStyle: '',
      font: '',
      textBaseline: 'alphabetic',
      textAlign: 'start',
    } as unknown as CanvasRenderingContext2D;

    drawGridBackground(ctx, song, vp({ measureCount: 1 }), 400);
    expect(strokeStyles.filter((s) => s === '#E5E7EB').length).toBeGreaterThanOrEqual(1);
    expect(strokeStyles.filter((s) => s === '#6B7280').length).toBeGreaterThanOrEqual(1);
    const lastGrid = strokeStyles.lastIndexOf('#E5E7EB');
    const firstBar = strokeStyles.indexOf('#6B7280');
    expect(lastGrid).not.toBe(-1);
    expect(firstBar).not.toBe(-1);
    expect(lastGrid).toBeLessThan(firstBar);
  });

  it('applies measure number typography and color on draw', () => {
    const song = minimalSong44(1);
    let fillStyle = '';
    let font = '';
    const ctx = {
      save: () => undefined,
      restore: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => undefined,
      fillText: () => undefined,
      set fillStyle(v: string) {
        fillStyle = v;
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
      strokeStyle: '',
      lineWidth: 1,
      textBaseline: 'alphabetic',
      textAlign: 'start',
    } as unknown as CanvasRenderingContext2D;

    drawGridBackground(ctx, song, vp({ measureCount: 1 }), 200);
    expect(fillStyle).toBe(MEASURE_NUMBER_COLOR);
    expect(font).toBe(MEASURE_NUMBER_FONT);
  });

  it('only includes visible measures and scales horizontal extent with zoom (BEAT_WIDTH)', () => {
    const song = minimalSong44(4);
    const layout = computeGridBackgroundLayout(song, vp({ startMeasure: 1, measureCount: 1, zoom: 2 }));

    expect(layout.measureNumbers).toHaveLength(1);
    expect(layout.measureNumbers[0]?.label).toBe('2');
    expect(layout.measureNumbers[0]?.measureIndex).toBe(1);

    // Width of one 4/4 measure at zoom 2 → 8 quarter beats × BEAT_WIDTH
    const span =
      absoluteTickToViewportX(384, vp({ startMeasure: 1, measureCount: 1, zoom: 2 }), song) -
      absoluteTickToViewportX(192, vp({ startMeasure: 1, measureCount: 1, zoom: 2 }), song);
    expect(span).toBeCloseTo(8 * BEAT_WIDTH, 10);
  });

  it('handles 3/4 meter: grid steps land on quarter ticks within 144-tick measure', () => {
    const song: SongData = {
      version: '1.0',
      metadata: {
        title: 't',
        key: 'C',
        scale: 'major',
        tempo: 120,
        meter: { numerator: 3, denominator: 4 },
      },
      measures: [emptyMeasure('a')],
      bandConfig: { tracks: [] },
    };
    const layout = computeGridBackgroundLayout(song, vp({ measureCount: 1 }));
    // 144 ticks → internal beats at +48, +96 only
    expect(layout.gridLines).toEqual([
      absoluteTickToViewportX(48, vp({ measureCount: 1 }), song),
      absoluteTickToViewportX(96, vp({ measureCount: 1 }), song),
    ]);
  });

  it('returns empty geometry when viewport is outside the song', () => {
    const song = minimalSong44(2);
    expect(computeGridBackgroundLayout(song, vp({ startMeasure: 10, measureCount: 2 })).barLines).toEqual([]);
  });
});

describe('grid background — TPQN alignment', () => {
  it('steps grid lines in multiples of TPQN (48) tick offsets from each downbeat', () => {
    const song = minimalSong44(1);
    const v = vp({ measureCount: 1 });
    const layout = computeGridBackgroundLayout(song, v);
    const origin = absoluteTickToViewportX(0, v, song);
    for (const gx of layout.gridLines) {
      const deltaPx = gx - origin;
      const ticks = Math.round(deltaPx / (BEAT_WIDTH / TPQN));
      expect(ticks % TPQN).toBe(0);
    }
  });
});

/** Matches `drawGridBackground`: crisp vertical lines on half-pixel coordinates. */
function expectedVerticalLineX(viewportX: number): number {
  return Math.round(viewportX) + 0.5;
}

function gridDrawCtxStub(
  extra: Record<string, unknown>,
): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    lineWidth: 1,
    set strokeStyle(_v: string) {
      /* canvas stub */
    },
    get strokeStyle() {
      return '';
    },
    set fillStyle(_v: string) {
      /* canvas stub */
    },
    get fillStyle() {
      return '';
    },
    set font(_v: string) {
      /* canvas stub */
    },
    get font() {
      return '';
    },
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    textAlign: 'start' as CanvasTextAlign,
    ...extra,
  } as unknown as CanvasRenderingContext2D;
}

function blendPat010Fill(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const br = Math.round(255 * (1 - alpha) + r * alpha);
  const bg = Math.round(255 * (1 - alpha) + g * alpha);
  const bb = Math.round(255 * (1 - alpha) + b * alpha);
  return `rgb(${br},${bg},${bb})`;
}

describe('grid background — canvas draw calls (TASK-2.14)', () => {
  it('calls fillText with measure number labels at label X and header midline Y', () => {
    const song = minimalSong44(3);
    const view = vp({ startMeasure: 0, measureCount: 3, zoom: 1 });
    const layout = computeGridBackgroundLayout(song, view);
    const fillText = vi.fn();
    const ctx = gridDrawCtxStub({ fillText });

    drawGridBackground(ctx, song, view, 400);

    const labelY = MEASURE_HEADER_HEIGHT / 2;
    expect(fillText).toHaveBeenCalledTimes(layout.measureNumbers.length);
    for (const { label, x } of layout.measureNumbers) {
      expect(fillText).toHaveBeenCalledWith(label, x, labelY);
    }
  });

  it('uses MEASURE_NUMBER_COLOR and MEASURE_NUMBER_FONT immediately before fillText', () => {
    const song = minimalSong44(1);
    const view = vp({ measureCount: 1 });
    const fillText = vi.fn();
    const fillStyleSeq: string[] = [];
    const fontSeq: string[] = [];
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText,
      lineWidth: 1,
      set strokeStyle(_v: string) {
        /* canvas stub */
      },
      get strokeStyle() {
        return '';
      },
      set fillStyle(v: string) {
        fillStyleSeq.push(v);
      },
      get fillStyle() {
        return fillStyleSeq[fillStyleSeq.length - 1] ?? '';
      },
      set font(v: string) {
        fontSeq.push(v);
      },
      get font() {
        return fontSeq[fontSeq.length - 1] ?? '';
      },
      textBaseline: 'alphabetic' as CanvasTextBaseline,
      textAlign: 'start' as CanvasTextAlign,
    } as unknown as CanvasRenderingContext2D;

    drawGridBackground(ctx, song, view, 200);
    const idx = fillStyleSeq.lastIndexOf(MEASURE_NUMBER_COLOR);
    expect(idx).not.toBe(-1);
    expect(fontSeq[idx]).toBe(MEASURE_NUMBER_FONT);
  });

  it('paints the chord-strip letter band with CHORD_LETTER_STRIP_HEIGHT using white fill', () => {
    const song = minimalSong44(1);
    const view = vp({ measureCount: 1, zoom: 1 });
    const gridContentWidthPx = 320;
    const fillRectCalls: { x: number; y: number; w: number; h: number; color: string }[] = [];
    let currentFillStyle = '';
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
        fillRectCalls.push({ x, y, w, h, color: currentFillStyle });
      }),
      lineWidth: 1,
      set fillStyle(v: string) {
        currentFillStyle = v;
      },
      get fillStyle() {
        return currentFillStyle;
      },
      set font(_v: string) {
        /* no-op */
      },
      get font() {
        return '';
      },
      set strokeStyle(_v: string) {
        /* no-op */
      },
      get strokeStyle() {
        return '';
      },
      textBaseline: 'alphabetic' as CanvasTextBaseline,
      textAlign: 'start' as CanvasTextAlign,
    } as unknown as CanvasRenderingContext2D;

    drawGridBackground(ctx, song, view, 700, { melodyRowHeight: NOTE_HEIGHT, gridContentWidthPx });
    const stripY = bottomChordStripTopY(NOTE_HEIGHT);
    const stripRect = fillRectCalls.find(
      (c) =>
        c.x === 0 &&
        c.y === stripY &&
        c.w === gridContentWidthPx &&
        c.h === CHORD_LETTER_STRIP_HEIGHT &&
        c.color === 'white',
    );
    expect(stripRect).toBeDefined();
  });

  it('issues moveTo with half-pixel X matching rounded viewport X for bar lines and beat lines at zoom 1', () => {
    const song = minimalSong44(2);
    const view = vp({ measureCount: 2, zoom: 1 });
    const layout = computeGridBackgroundLayout(song, view);
    const moveTo = vi.fn();
    const ctx = gridDrawCtxStub({ moveTo });

    drawGridBackground(ctx, song, view, 300);

    const expectedXs = new Set<number>();
    for (const x of layout.gridLines) {
      expectedXs.add(expectedVerticalLineX(x));
    }
    for (const x of layout.barLines) {
      expectedXs.add(expectedVerticalLineX(x));
    }
    const moveXs = moveTo.mock.calls.map((c) => c[0] as number);
    for (const xi of expectedXs) {
      expect(moveXs).toContain(xi);
    }
  });

  it('scales bar line and beat line moveTo X with zoom 2 (PAT-012 BEAT_WIDTH × zoom)', () => {
    const song = minimalSong44(1);
    const view = vp({ measureCount: 1, zoom: 2 });
    const layout = computeGridBackgroundLayout(song, view);
    const moveTo = vi.fn();
    const ctx = gridDrawCtxStub({ moveTo });

    drawGridBackground(ctx, song, view, 300);

    // Single 4/4 measure: grid at beats 2–4 → ticks 48, 96, 144; bars at 0 and 192
    expect(layout.gridLines).toHaveLength(3);
    for (const gx of layout.gridLines) {
      expect(moveTo).toHaveBeenCalledWith(expectedVerticalLineX(gx), 0);
    }
    for (const bx of layout.barLines) {
      expect(moveTo).toHaveBeenCalledWith(expectedVerticalLineX(bx), 0);
    }
  });

  it('uses wider horizontal spacing at zoom 0.5 so measure number fillText X shifts accordingly', () => {
    const song = minimalSong44(2);
    const view = vp({ startMeasure: 1, measureCount: 1, zoom: 0.5 });
    const layout = computeGridBackgroundLayout(song, view);
    const fillText = vi.fn();
    const ctx = gridDrawCtxStub({ fillText });

    drawGridBackground(ctx, song, view, 200);
    expect(fillText).toHaveBeenCalledWith(
      layout.measureNumbers[0]!.label,
      layout.measureNumbers[0]!.x,
      MEASURE_HEADER_HEIGHT / 2,
    );
  });

  it('fills each visible melody row with deterministic PAT-010 tint geometry', () => {
    const song = minimalSong44(1);
    const view = vp({ measureCount: 1, zoom: 1, scrollY: 0 });
    const gridContentWidthPx = 320;
    const canvasHeight = noteStaffTopY() + MELODY_DIATONIC_ROW_COUNT * NOTE_HEIGHT + CHORD_AREA_HEIGHT + CHORD_LETTER_STRIP_HEIGHT;
    const fillRectCalls: { x: number; y: number; w: number; h: number; color: string }[] = [];
    let currentFillStyle = '';

    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
        fillRectCalls.push({ x, y, w, h, color: currentFillStyle });
      }),
      lineWidth: 1,
      set fillStyle(v: string) {
        currentFillStyle = v;
      },
      get fillStyle() {
        return currentFillStyle;
      },
      set font(_v: string) {
        /* no-op */
      },
      get font() {
        return '';
      },
      set strokeStyle(_v: string) {
        /* no-op */
      },
      get strokeStyle() {
        return '';
      },
      textBaseline: 'alphabetic' as CanvasTextBaseline,
      textAlign: 'start' as CanvasTextAlign,
    } as unknown as CanvasRenderingContext2D;

    drawGridBackground(ctx, song, view, canvasHeight, { melodyRowHeight: NOTE_HEIGHT, gridContentWidthPx });

    const staffTop = noteStaffTopY();
    const stripY = bottomChordStripTopY(NOTE_HEIGHT);
    const tintCalls = fillRectCalls.filter((c) => c.h === NOTE_HEIGHT && c.y < stripY);
    expect(tintCalls).toHaveLength(MELODY_DIATONIC_ROW_COUNT);
    for (let r = 0; r < MELODY_DIATONIC_ROW_COUNT; r++) {
      const expectedDegree = (((r % 7) + 1) as unknown) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
      expect(tintCalls[r]).toMatchObject({
        x: 0,
        y: staffTop + r * NOTE_HEIGHT,
        w: gridContentWidthPx,
        h: NOTE_HEIGHT,
        color: blendPat010Fill(pat010DiatonicHex(expectedDegree), 0.08),
      });
    }
    expect(tintCalls.every((c) => c.color.startsWith('rgb('))).toBe(true);
  });
});
