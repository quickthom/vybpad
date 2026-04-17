/*
 * QA COVERAGE PLAN — UI-W2 (RA-2 — bottom chord track strip)
 *
 * Criterion 1 — Multiple chords across measures: Roman + name aligned in time with grid
 *   happy: ≥2 chords in different measures → layout x matches absoluteTickToViewportX; same vertical band
 *   error: —
 *   edges: viewport startMeasure > 0 (origin shift)
 *
 * Criterion 2 — Strip visually distinct from note area (UX §6 / PAT-012)
 *   happy: chord blocks live in bottom CHORD_AREA_HEIGHT flush to canvas bottom; melody band is above (no shared y-range)
 *   error: —
 *   edges: default NOTE_HEIGHT staff
 *
 * Criterion 3 — No overlap hiding Wave 1 note horizontal bars
 *   happy: noteStaffTopY() is directly under header; bottom strip begins after full MELODY_DIATONIC_ROW_COUNT rows
 *   error: —
 *   edges: —
 */

import type { ChordEvent, SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it, vi } from 'vitest';

import { theoryEngine } from '../../../../src/engine/theory/theoryEngine';
import {
  CHORD_AREA_HEIGHT,
  CHORD_LETTER_STRIP_HEIGHT,
  MELODY_DIATONIC_ROW_COUNT,
  MEASURE_HEADER_HEIGHT,
  NOTE_HEIGHT,
} from '../../../../src/engine/renderer/constants';
import { drawChordBlocks, layoutChordBlock, pixelsPerTick } from '../../../../src/engine/renderer/index';
import { absoluteTickFromMeasurePosition, absoluteTickToViewportX, noteStaffTopY } from '../../../../src/engine/renderer/layout';

function chord(partial: Partial<ChordEvent> & Pick<ChordEvent, 'id' | 'scaleDegree' | 'quality'>): ChordEvent {
  return {
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat: partial.beat ?? 0,
    duration: partial.duration ?? 48,
    ...partial,
  };
}

function songTwoMeasuresTwoChords(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'UI-W2',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        chords: [chord({ id: 'c-m0', scaleDegree: 1, quality: 'major', beat: 0, duration: 96 })],
        notes: [[], [], [], []],
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        chords: [chord({ id: 'c-m1', scaleDegree: 5, quality: 'major', beat: 0, duration: 96 })],
        notes: [[], [], [], []],
      },
    ],
    bandConfig: { tracks: [] },
  };
}

/** Matches EditorCanvas `canvasHeightPx` / Wave 1 melody stack with default staff spacing. */
function editorCanvasContentHeightPx(rowHeight: number = NOTE_HEIGHT): number {
  return MEASURE_HEADER_HEIGHT + MELODY_DIATONIC_ROW_COUNT * rowHeight + CHORD_AREA_HEIGHT + CHORD_LETTER_STRIP_HEIGHT;
}

/** Top Y of the bottom chord strip (below the full piano-roll diatonic grid). */
function expectedBottomChordStripTopY(rowHeight: number = NOTE_HEIGHT): number {
  return MEASURE_HEADER_HEIGHT + MELODY_DIATONIC_ROW_COUNT * rowHeight;
}

function createChordBlocksDrawContext(): {
  ctx: CanvasRenderingContext2D;
  roundRect: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
} {
  const roundRect = vi.fn();
  const fillText = vi.fn();
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    roundRect,
    fillRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText,
    measureText: vi.fn(() => ({ width: 200 })),
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    font: '',
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
    shadowColor: '',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, roundRect, fillText };
}

describe('UI-W2 — bottom chord track strip (RA-2)', () => {
  describe('happy path', () => {
    it('places the melody staff directly under the measure header so Wave 1 retains the full diatonic row count', () => {
      expect(noteStaffTopY()).toBe(MEASURE_HEADER_HEIGHT);
    });

    it('lays chord blocks in the bottom CHORD_AREA_HEIGHT band flush to the editor canvas bottom (distinct from melody)', () => {
      const h = editorCanvasContentHeightPx(NOTE_HEIGHT);
      const stripTop = expectedBottomChordStripTopY(NOTE_HEIGHT);
      expect(stripTop + CHORD_AREA_HEIGHT + CHORD_LETTER_STRIP_HEIGHT).toBe(h);

      const song = songTwoMeasuresTwoChords();
      const viewport: Viewport = { startMeasure: 0, measureCount: 2, scrollY: 0, zoom: 1 };
      const r0 = layoutChordBlock(song.measures[0].chords[0], 0, song, viewport);
      const r1 = layoutChordBlock(song.measures[1].chords[0], 1, song, viewport);

      expect(r0.y).toBe(stripTop);
      expect(r1.y).toBe(stripTop);
      expect(r0.y + r0.height).toBe(h);
      expect(r1.y + r1.height).toBe(h);
    });

    it('maps each chord block’s left edge to absoluteTickToViewportX for chords in different measures', () => {
      const song = songTwoMeasuresTwoChords();
      const viewport: Viewport = { startMeasure: 0, measureCount: 2, scrollY: 0, zoom: 1 };

      const ch0 = song.measures[0].chords[0];
      const ch1 = song.measures[1].chords[0];

      const t0 = absoluteTickFromMeasurePosition(song, 0, ch0.beat);
      const t1 = absoluteTickFromMeasurePosition(song, 1, ch1.beat);

      const r0 = layoutChordBlock(ch0, 0, song, viewport);
      const r1 = layoutChordBlock(ch1, 1, song, viewport);

      expect(r0.x).toBeCloseTo(absoluteTickToViewportX(t0, viewport, song), 5);
      expect(r1.x).toBeCloseTo(absoluteTickToViewportX(t1, viewport, song), 5);
      expect(r0.width).toBe(ch0.duration * pixelsPerTick(viewport.zoom));
      expect(r1.width).toBe(ch1.duration * pixelsPerTick(viewport.zoom));
    });

    it('draws Roman + chord name labels inside the bottom strip vertical range when using labelMode roman', () => {
      const song = songTwoMeasuresTwoChords();
      const viewport: Viewport = { startMeasure: 0, measureCount: 2, scrollY: 0, zoom: 1 };
      const stripTop = expectedBottomChordStripTopY(NOTE_HEIGHT);
      const { ctx, fillText } = createChordBlocksDrawContext();

      drawChordBlocks(ctx, song, viewport, theoryEngine, { labelMode: 'roman' });

      expect(fillText.mock.calls.length).toBeGreaterThan(0);
      for (const call of fillText.mock.calls) {
        const y = call[2] as number;
        expect(y).toBeGreaterThanOrEqual(stripTop);
        expect(y).toBeLessThanOrEqual(stripTop + CHORD_AREA_HEIGHT + CHORD_LETTER_STRIP_HEIGHT);
      }
    });
  });

  describe('edge cases', () => {
    it('keeps tick alignment when the viewport is scrolled to a later measure', () => {
      const song = songTwoMeasuresTwoChords();
      const viewport: Viewport = { startMeasure: 1, measureCount: 1, scrollY: 0, zoom: 1 };
      const ch1 = song.measures[1].chords[0];
      const t1 = absoluteTickFromMeasurePosition(song, 1, ch1.beat);
      const r1 = layoutChordBlock(ch1, 1, song, viewport);
      expect(r1.x).toBeCloseTo(absoluteTickToViewportX(t1, viewport, song), 5);
    });
  });
});
