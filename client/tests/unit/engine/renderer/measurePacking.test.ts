/*
 * QA COVERAGE PLAN — UI-R2-W5.3
 *
 * Criterion 1: computeMeasuresPerLine packs whole measures by numeric canvas width + horizontal zoom
 *   happy: returns an integer count that matches expected floor packing for 4/4 measure width at zoom 1 and zoom 2
 *   error: non-increasing as zoom increases or width decreases; outputs remain numeric
 *   edges: wide vs narrow width and zoom-based contraction at non-integral widths
 *
 * Criterion 2: alignment with existing layout metrics
 *   happy: same base behavior as measureWidthPixels(song, measureIndex, zoom) for the same BEAT_WIDTH and meter
 *   edges: deterministic use of PAT-012 constants in caller inputs
 *
 * Criterion 3: TASK-8.0 stride safety compatibility (for MeasureBar callers)
 *   happy: output is always at least 1 so chunking loops using i += measuresPerLine remain safe
 *
 * Criterion 4: Barrel contract for renderer exports
 *   happy: `computeMeasuresPerLine` is exported from `src/engine/renderer/index`
 */

import type { Measure, SongData } from '@vybpad/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import * as rendererBarrel from '../../../../src/engine/renderer/index';
import { BEAT_WIDTH, MEASURE_HEADER_HEIGHT } from '../../../../src/engine/renderer/constants';
import { measureWidthPixels } from '../../../../src/engine/renderer/layout';

type ComputeMeasuresPerLine = (args: {
  canvasWidthPx: number;
  zoom: number;
  beatWidthPx: number;
  beatsPerMeasure?: number;
  measureHeaderHeightPx?: number;
}) => number;

let computeMeasuresPerLine!: ComputeMeasuresPerLine;

function emptyMeasure(id: string): Measure {
  return {
    id,
    chords: [],
    notes: [[], [], [], []],
  };
}

function minimalSong44(measureCount: number): SongData {
  const measures: Measure[] = [];
  for (let i = 0; i < measureCount; i += 1) {
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
    bandConfig: { tracks: [] },
  };
}

function minimalSongWithMeter(measureCount: number, meter: { numerator: number; denominator: number }): SongData {
  const song = minimalSong44(measureCount);
  song.metadata.meter = meter;
  return song;
}

beforeAll(() => {
  const fn = (rendererBarrel as { computeMeasuresPerLine?: unknown }).computeMeasuresPerLine;
  if (typeof fn === 'function') {
    computeMeasuresPerLine = fn as ComputeMeasuresPerLine;
    return;
  }
  throw new Error('computeMeasuresPerLine was not exported from client/src/engine/renderer/index.ts');
});

function safeCompute(args: { canvasWidthPx: number; zoom: number; measureHeaderHeightPx?: number; beatsPerMeasure?: number }): number {
  return computeMeasuresPerLine({
    ...args,
    beatWidthPx: BEAT_WIDTH,
  });
}

describe('measure packing (OB-15)', () => {
  describe('barrel contract', () => {
    it('exports computeMeasuresPerLine from client/src/engine/renderer/index.ts', () => {
      expect(Object.hasOwn(rendererBarrel, 'computeMeasuresPerLine')).toBe(true);
      expect(typeof (rendererBarrel as { computeMeasuresPerLine?: unknown }).computeMeasuresPerLine).toBe('function');
    });
  });

  describe('happy path', () => {
    it('returns an integer number of measures matching measureWidthPixels-based packing at zoom 1 and zoom 2', () => {
      const song = minimalSong44(12);
      const widthForThreeMeasures = measureWidthPixels(song, 0, 1) * 3;

      const atZoom1 = safeCompute({ canvasWidthPx: widthForThreeMeasures + 1, zoom: 1, measureHeaderHeightPx: 0 });
      const atZoom2 = safeCompute({
        canvasWidthPx: widthForThreeMeasures + 1,
        zoom: 2,
        measureHeaderHeightPx: 0,
      });

      expect(Number.isInteger(atZoom1)).toBe(true);
      expect(Number.isInteger(atZoom2)).toBe(true);
      expect(atZoom1).toBe(3);
      expect(atZoom2).toBe(1);
      expect(atZoom2).toBeLessThanOrEqual(atZoom1);
    });

    it('packs whole measures for fractional meters with widths aligned to measureWidthPixels', () => {
      const song = minimalSongWithMeter(12, { numerator: 5, denominator: 8 });
      const measureWidth = measureWidthPixels(song, 0, 1);
      const twoAndHalfMeasureWidth = measureWidth * 2.5;
      const threeMeasureWidth = measureWidth * 3;

      const packedAtTwoAndHalfMeasures = safeCompute({ canvasWidthPx: twoAndHalfMeasureWidth, zoom: 1, measureHeaderHeightPx: 0 });
      const packedAtThreeMeasures = safeCompute({ canvasWidthPx: threeMeasureWidth, zoom: 1, measureHeaderHeightPx: 0 });

      expect(packedAtTwoAndHalfMeasures).toBe(2);
      expect(packedAtTwoAndHalfMeasures).toBe(Math.floor(twoAndHalfMeasureWidth / measureWidth));
      expect(packedAtThreeMeasures).toBe(3);
    });

    it('returns fewer measures when canvas width shrinks for the same zoom', () => {
      const song = minimalSong44(12);
      const zoom = 1;
      const widthForThree = measureWidthPixels(song, 0, zoom) * 3;

      const wide = safeCompute({ canvasWidthPx: widthForThree + BEAT_WIDTH, zoom, measureHeaderHeightPx: 0 });
      const narrow = safeCompute({ canvasWidthPx: widthForThree - 1, zoom, measureHeaderHeightPx: 0 });

      expect(wide).toBe(3);
      expect(narrow).toBe(2);
    });
  });

  describe('error handling', () => {
    it('always clamps to at least 1 to preserve safe chunking strides (TASK-8.0)', () => {
      expect(safeCompute({ canvasWidthPx: 0, zoom: 1, measureHeaderHeightPx: MEASURE_HEADER_HEIGHT })).toBe(1);
      expect(safeCompute({ canvasWidthPx: -1, zoom: 1, measureHeaderHeightPx: MEASURE_HEADER_HEIGHT })).toBe(1);
      expect(safeCompute({ canvasWidthPx: Number.MIN_VALUE, zoom: 1, measureHeaderHeightPx: MEASURE_HEADER_HEIGHT })).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('is monotonic with non-positive and custom measureHeaderHeightPx inputs as additional layout constraints', () => {
      const width = 600;
      const noHeader = safeCompute({ canvasWidthPx: width, zoom: 1, measureHeaderHeightPx: 0 });
      const withHeader = safeCompute({ canvasWidthPx: width, zoom: 1, measureHeaderHeightPx: MEASURE_HEADER_HEIGHT });

      expect(Number.isInteger(noHeader)).toBe(true);
      expect(Number.isInteger(withHeader)).toBe(true);
      expect(withHeader).toBeLessThanOrEqual(noHeader);
      expect(withHeader).toBeGreaterThanOrEqual(1);
    });
  });
});

