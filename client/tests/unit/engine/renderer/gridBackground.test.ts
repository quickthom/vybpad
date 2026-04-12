import type { Measure, SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  absoluteTickToViewportX,
  BEAT_WIDTH,
  computeGridBackgroundLayout,
  drawGridBackground,
  MEASURE_NUMBER_COLOR,
  MEASURE_NUMBER_FONT,
  TPQN,
} from '../../../../src/engine/renderer/index';

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
