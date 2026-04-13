/*
 * QA COVERAGE PLAN — TASK-2.12
 *
 * Criterion 1: Chord-tone notes — brightening via fillRect (or similar) on note geometry
 * Criterion 2: Scale-tone — no overlay fillRect at note rect after baseline note draw
 * Criterion 3: Chromatic — dark rgba overlay fillRect at note coords
 * Criterion 4: showGuides === false — overlay does not call fillRect
 * Criterion 5: Active chord lookup — same-measure chord; previous-measure fallback; empty window
 * Criterion 6: Barrel export — drawGuideOverlay from renderer index
 */

import type { ChordEvent, Measure, NoteEvent, SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it, vi } from 'vitest';

import { theoryEngine } from '../../../../src/engine/theory/theoryEngine';
import {
  drawGuideOverlay,
  GUIDE_CHORD_TONE_UNDERLINE_PX,
} from '../../../../src/engine/renderer/guideOverlay';
import { computeNoteBlockRect, drawNoteBlocks } from '../../../../src/engine/renderer/noteBlocks';
import * as rendererBarrel from '../../../../src/engine/renderer/index';

function emptyMeasure(id: string): Measure {
  return { id, chords: [], notes: [[], [], [], []] };
}

function minimalSong(measureCount: number): SongData {
  const measures: Measure[] = [];
  for (let i = 0; i < measureCount; i++) {
    measures.push(emptyMeasure(`00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`));
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

function baseChord(partial: Partial<ChordEvent> & Pick<ChordEvent, 'beat' | 'duration'>): ChordEvent {
  return {
    id: '00000000-0000-4000-8000-000000000c01',
    scaleDegree: 1,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    ...partial,
  };
}

function note(partial: Partial<NoteEvent> & Pick<NoteEvent, 'beat' | 'duration'>): NoteEvent {
  return {
    id: '00000000-0000-4000-8000-0000000000n1',
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    velocity: 100,
    isRest: false,
    ...partial,
  };
}

type FillRectCapture = { fillStyle: string; x: number; y: number; w: number; h: number };

function createOverlayCtx(): {
  ctx: CanvasRenderingContext2D;
  captures: FillRectCapture[];
} {
  const captures: FillRectCapture[] = [];
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fillRect: vi.fn(function fillRectImpl(this: { fillStyle: string | CanvasGradient | CanvasPattern }, x: number, y: number, w: number, h: number) {
      captures.push({
        fillStyle: String(this.fillStyle),
        x,
        y,
        w,
        h,
      });
    }),
    stroke: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    clip: vi.fn(),
    lineWidth: 1,
    strokeStyle: '',
    font: '',
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
    measureText: vi.fn(() => ({ width: 8 })),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, captures };
}

describe('guide overlay — TASK-2.12 — chord-tone brightening', () => {
  describe('happy path', () => {
    it('sets fillStyle to a brighter rgb and calls fillRect on the chord-tone highlight strip for the note block', () => {
      const song = minimalSong(1);
      song.measures[0].chords = [baseChord({ beat: 0, duration: 192 })];
      const n = note({ beat: 48, duration: 48, scaleDegree: 1, chromatic: 0 });
      song.measures[0].notes[0] = [n];

      const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
      const rect = computeNoteBlockRect({
        song,
        viewport,
        measureIndex: 0,
        note: n,
        isRest: false,
      });
      const stripH = Math.min(GUIDE_CHORD_TONE_UNDERLINE_PX, rect.height);

      const { ctx, captures } = createOverlayCtx();

      drawGuideOverlay(ctx, song, viewport, 'diatonic', { showGuides: true, theoryEngine });

      const match = captures.find(
        (c) =>
          c.x === rect.x &&
          c.y === rect.y + rect.height - stripH &&
          c.w === rect.width &&
          c.h === stripH,
      );
      expect(match, 'chord-tone overlay should fillRect the bottom strip inside the note block').toBeDefined();
      expect(match!.fillStyle).toMatch(/^rgb\(/i);
    });
  });
});

describe('guide overlay — TASK-2.12 — scale-tone (no overlay fill)', () => {
  describe('happy path', () => {
    it('does not call fillRect at the note block rect for a scale-tone note after baseline note draw', () => {
      const song = minimalSong(1);
      song.measures[0].chords = [baseChord({ beat: 0, duration: 192 })];
      const n = note({ beat: 48, duration: 48, scaleDegree: 2, chromatic: 0 });
      song.measures[0].notes[0] = [n];

      const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
      const rect = computeNoteBlockRect({
        song,
        viewport,
        measureIndex: 0,
        note: n,
        isRest: false,
      });

      const { ctx, captures } = createOverlayCtx();
      drawNoteBlocks(ctx, song, viewport);
      captures.splice(0);
      (ctx.fillRect as ReturnType<typeof vi.fn>).mockClear();

      drawGuideOverlay(ctx, song, viewport, 'diatonic', { showGuides: true, theoryEngine });

      const atNoteBlock = captures.filter(
        (c) =>
          c.x >= rect.x &&
          c.x + c.w <= rect.x + rect.width + 0.001 &&
          c.y >= rect.y &&
          c.y + c.h <= rect.y + rect.height + 0.001,
      );
      expect(atNoteBlock).toHaveLength(0);
    });
  });
});

describe('guide overlay — TASK-2.12 — chromatic darkening', () => {
  describe('happy path', () => {
    it('applies a semi-transparent dark rgba(0,0,0,…) fillRect across the note block rect', () => {
      const song = minimalSong(1);
      song.measures[0].chords = [baseChord({ beat: 0, duration: 192 })];
      const n = note({ beat: 48, duration: 48, scaleDegree: 1, chromatic: 1 });
      song.measures[0].notes[0] = [n];

      const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
      const rect = computeNoteBlockRect({
        song,
        viewport,
        measureIndex: 0,
        note: n,
        isRest: false,
      });

      const { ctx, captures } = createOverlayCtx();

      drawGuideOverlay(ctx, song, viewport, 'diatonic', { showGuides: true, theoryEngine });

      const match = captures.find(
        (c) => c.x === rect.x && c.y === rect.y && c.w === rect.width && c.h === rect.height,
      );
      expect(match, 'chromatic overlay should cover the full note block rect').toBeDefined();
      expect(match!.fillStyle).toMatch(/rgba\(\s*0\s*,\s*0\s*,\s*0/i);
    });
  });
});

describe('guide overlay — TASK-2.12 — showGuides off', () => {
  describe('happy path', () => {
    it('does not invoke fillRect on the overlay pass when showGuides is false', () => {
      const song = minimalSong(1);
      song.measures[0].chords = [baseChord({ beat: 0, duration: 192 })];
      song.measures[0].notes[0] = [note({ beat: 48, duration: 48, scaleDegree: 1 })];

      const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
      const fillRect = vi.fn();
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        fillStyle: '',
        fillRect,
      } as unknown as CanvasRenderingContext2D;

      drawGuideOverlay(ctx, song, viewport, 'diatonic', { showGuides: false, theoryEngine });

      expect(fillRect).not.toHaveBeenCalled();
    });
  });
});

describe('guide overlay — TASK-2.12 — active chord resolution', () => {
  describe('happy path', () => {
    it('uses the chord at beat 0 to classify a note at beat 48 in the same measure (chord-tone strip)', () => {
      const song = minimalSong(1);
      song.measures[0].chords = [baseChord({ beat: 0, duration: 192 })];
      const n = note({ beat: 48, duration: 48, scaleDegree: 1, chromatic: 0 });
      song.measures[0].notes[0] = [n];

      const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
      const rect = computeNoteBlockRect({
        song,
        viewport,
        measureIndex: 0,
        note: n,
        isRest: false,
      });
      const stripH = Math.min(GUIDE_CHORD_TONE_UNDERLINE_PX, rect.height);

      const { ctx, captures } = createOverlayCtx();
      drawGuideOverlay(ctx, song, viewport, 'diatonic', { showGuides: true, theoryEngine });

      const bright = captures.find(
        (c) =>
          c.x === rect.x &&
          c.y === rect.y + rect.height - stripH &&
          c.w === rect.width &&
          c.h === stripH,
      );
      expect(bright).toBeDefined();
    });

    it('falls back to the previous measure chord when the current measure has no chords (no throw)', () => {
      const song = minimalSong(2);
      song.measures[0].chords = [baseChord({ beat: 0, duration: 192 })];
      song.measures[1].chords = [];
      const n = note({ beat: 0, duration: 48, scaleDegree: 1, chromatic: 0 });
      song.measures[1].notes[0] = [n];

      const viewport: Viewport = { startMeasure: 0, measureCount: 2, scrollY: 0, zoom: 1 };
      const rect = computeNoteBlockRect({
        song,
        viewport,
        measureIndex: 1,
        note: n,
        isRest: false,
      });
      const stripH = Math.min(GUIDE_CHORD_TONE_UNDERLINE_PX, rect.height);

      const { ctx, captures } = createOverlayCtx();
      expect(() =>
        drawGuideOverlay(ctx, song, viewport, 'diatonic', { showGuides: true, theoryEngine }),
      ).not.toThrow();

      const bright = captures.find(
        (c) =>
          c.x === rect.x &&
          c.y === rect.y + rect.height - stripH &&
          c.w === rect.width &&
          c.h === stripH,
      );
      expect(bright).toBeDefined();
    });

    it('skips notes silently when no chord exists in the preceding lookup window (no throw, no overlay fillRect)', () => {
      const song = minimalSong(5);
      for (let m = 0; m < 4; m++) {
        song.measures[m].chords = [];
      }
      const n = note({ beat: 0, duration: 48, scaleDegree: 3, chromatic: 0 });
      song.measures[4].notes[0] = [n];

      const viewport: Viewport = { startMeasure: 0, measureCount: 5, scrollY: 0, zoom: 1 };
      const { ctx, captures } = createOverlayCtx();

      expect(() =>
        drawGuideOverlay(ctx, song, viewport, 'diatonic', { showGuides: true, theoryEngine }),
      ).not.toThrow();

      expect(captures).toHaveLength(0);
    });
  });
});

describe('guide overlay — TASK-2.12 — barrel export', () => {
  it('exports drawGuideOverlay as a function from client/src/engine/renderer/index.ts', () => {
    expect(Object.hasOwn(rendererBarrel, 'drawGuideOverlay')).toBe(true);
    expect(typeof (rendererBarrel as { drawGuideOverlay: unknown }).drawGuideOverlay).toBe('function');
  });
});
