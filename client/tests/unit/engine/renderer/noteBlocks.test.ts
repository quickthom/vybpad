import type { Measure, NoteEvent, SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  BEAT_WIDTH,
  NOTE_HEIGHT,
  absoluteTickToViewportX,
  chromaticYOffset,
  noteRowYFromNoteEvent,
  noteStaffTopY,
  pixelsPerTick,
} from '../../../../src/engine/renderer/layout';
import {
  NOTE_BLOCK_CORNER_RADIUS,
  NOTE_BLOCK_VERTICAL_INSET,
  REST_VERTICAL_ANCHOR,
  blendDegreeFillWithWhite,
  computeNoteBlockRect,
  drawNoteBlocks,
  effectiveDegreeForColor,
  formatDegreeLabelParts,
  getKeyScaleAtMeasure,
  noteBlockFillColor,
  pitchClassToNearestMajorScaleDegree,
  referenceMajorTonicPitchClass,
} from '../../../../src/engine/renderer/noteBlocks';

function emptyMeasure(id: string): Measure {
  return { id, chords: [], notes: [[], [], [], []] };
}

function minimalSong(): SongData {
  const measures: Measure[] = [];
  for (let i = 0; i < 4; i++) {
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

function note(partial: Partial<NoteEvent> & Pick<NoteEvent, 'beat' | 'duration'>): NoteEvent {
  return {
    id: 'n1',
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    velocity: 100,
    isRest: false,
    ...partial,
  };
}

describe('noteBlocks (TASK-2.5)', () => {
  it('block width = duration × pixelsPerTick(zoom); height = NOTE_HEIGHT − 2px inset', () => {
    const song = minimalSong();
    const viewport: Viewport = { startMeasure: 0, measureCount: 4, scrollY: 0, zoom: 1 };
    const n = note({ beat: 0, duration: 48 });
    const r = computeNoteBlockRect({ song, viewport, measureIndex: 0, note: n, isRest: false });
    expect(r.width).toBe(48 * pixelsPerTick(1));
    expect(r.height).toBe(NOTE_HEIGHT - 2 * NOTE_BLOCK_VERTICAL_INSET);
  });

  it('maps horizontal position via layout absolute tick → viewport X', () => {
    const song = minimalSong();
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 2 };
    const n = note({ beat: 48, duration: 24 });
    const r = computeNoteBlockRect({ song, viewport, measureIndex: 0, note: n, isRest: false });
    const expectedX = absoluteTickToViewportX(48, viewport, song);
    expect(r.x).toBe(expectedX);
    expect(r.width).toBe(24 * pixelsPerTick(2));
  });

  it('vertical position uses noteRowYFromNoteEvent + inset', () => {
    const song = minimalSong();
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 100, zoom: 1 };
    const n = note({ scaleDegree: 3, octave: 1, chromatic: 0, beat: 0, duration: 48 });
    const r = computeNoteBlockRect({ song, viewport, measureIndex: 0, note: n, isRest: false });
    const rowTop = noteRowYFromNoteEvent(n, viewport.scrollY);
    expect(r.y).toBe(rowTop + NOTE_BLOCK_VERTICAL_INSET);
  });

  it('PAT-018: chromatic offset shifts Y by chromaticYOffset', () => {
    const song = minimalSong();
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const diatonic = note({ scaleDegree: 5, octave: 0, chromatic: 0, beat: 0, duration: 48 });
    const sharp = note({ scaleDegree: 5, octave: 0, chromatic: 1, beat: 0, duration: 48 });
    const a = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: diatonic,
      isRest: false,
    }).y;
    const b = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: sharp,
      isRest: false,
    }).y;
    expect(b - a).toBe(chromaticYOffset(1));
  });

  it('rest block uses REST_VERTICAL_ANCHOR row, not pitch fields', () => {
    const song = minimalSong();
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 40, zoom: 1 };
    const n = note({
      scaleDegree: 1,
      octave: 2,
      chromatic: 0,
      beat: 0,
      duration: 96,
      isRest: true,
    });
    const r = computeNoteBlockRect({ song, viewport, measureIndex: 0, note: n, isRest: true });
    const anchorTop = noteRowYFromNoteEvent(
      {
        ...n,
        scaleDegree: REST_VERTICAL_ANCHOR.scaleDegree,
        octave: REST_VERTICAL_ANCHOR.octave,
        chromatic: REST_VERTICAL_ANCHOR.chromatic,
      },
      viewport.scrollY,
    );
    expect(r.y).toBe(anchorTop + NOTE_BLOCK_VERTICAL_INSET);
  });

  it('degree label: PAT-018 accidentals and octave indicator', () => {
    expect(formatDegreeLabelParts(note({ beat: 0, duration: 48, chromatic: -1 }))).toEqual({
      accidentalPrefix: '♭',
      degreeNumeral: '1',
      octaveIndicator: null,
    });
    expect(formatDegreeLabelParts(note({ beat: 0, duration: 48, chromatic: 1 }))).toEqual({
      accidentalPrefix: '♯',
      degreeNumeral: '1',
      octaveIndicator: null,
    });
    expect(formatDegreeLabelParts(note({ beat: 0, duration: 48, octave: 2 }))).toEqual({
      accidentalPrefix: '',
      degreeNumeral: '1',
      octaveIndicator: '+2',
    });
    expect(formatDegreeLabelParts(note({ beat: 0, duration: 48, octave: -1 }))).toEqual({
      accidentalPrefix: '',
      degreeNumeral: '1',
      octaveIndicator: '-1',
    });
  });

  it('PAT-010 diatonic vs major-centric effective degree', () => {
    const n = note({ scaleDegree: 1, octave: 0, chromatic: 0, beat: 0, duration: 48 });
    expect(effectiveDegreeForColor(n, 'A', 'minor', 'diatonic')).toBe(1);
    // A natural minor tonic A → 6th of C major → blue degree 6
    expect(effectiveDegreeForColor(n, 'A', 'minor', 'major')).toBe(6);
  });

  it('referenceMajorTonicPitchClass and pitchClassToNearestMajorScaleDegree', () => {
    expect(referenceMajorTonicPitchClass('A', 'minor')).toBe(0); // C
    expect(referenceMajorTonicPitchClass('C', 'major')).toBe(0);
    expect(pitchClassToNearestMajorScaleDegree(9, 0)).toBe(6); // A in C major
  });

  it('chromatic notes use muted fill vs diatonic (same hue family)', () => {
    const diatonic = note({ scaleDegree: 3, octave: 0, chromatic: 0, beat: 0, duration: 48 });
    const chrom = note({ scaleDegree: 3, octave: 0, chromatic: 1, beat: 0, duration: 48 });
    const a = noteBlockFillColor(diatonic, 'C', 'major', 'diatonic');
    const b = noteBlockFillColor(chrom, 'C', 'major', 'diatonic');
    expect(a).not.toBe(b);
    expect(a.startsWith('rgb(')).toBe(true);
    expect(b.startsWith('rgb(')).toBe(true);
  });

  it('getKeyScaleAtMeasure inherits measure changes', () => {
    const song = minimalSong();
    song.measures[1] = {
      ...song.measures[1]!,
      changes: { key: 'G', scale: 'major' },
    };
    expect(getKeyScaleAtMeasure(song, 0).key).toBe('C');
    expect(getKeyScaleAtMeasure(song, 1).key).toBe('G');
    expect(getKeyScaleAtMeasure(song, 2).key).toBe('G');
  });

  it('blendDegreeFillWithWhite keeps PAT-010 hue readable on white canvas', () => {
    expect(blendDegreeFillWithWhite('#E74C3C')).toMatch(/^rgb\(/);
  });

  it('note staff top matches layout for scroll tests', () => {
    expect(noteStaffTopY()).toBe(24);
  });

  it('4/4 quarter note width at zoom 1 equals BEAT_WIDTH', () => {
    const song = minimalSong();
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const n = note({ beat: 0, duration: 48 });
    const r = computeNoteBlockRect({ song, viewport, measureIndex: 0, note: n, isRest: false });
    expect(r.width).toBe(BEAT_WIDTH);
  });
});

function createNoteBlocksDrawContext(): {
  ctx: CanvasRenderingContext2D;
  roundRect: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  setLineDash: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
} {
  const roundRect = vi.fn();
  const fillRect = vi.fn();
  const setLineDash = vi.fn();
  const fillText = vi.fn();
  const measureText = vi.fn(() => ({ width: 6 }));
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    roundRect,
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    fillRect,
    stroke: vi.fn(),
    fillText,
    measureText,
    setLineDash,
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    font: '',
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, roundRect, fillRect, setLineDash, fillText, measureText };
}

describe('noteBlocks — canvas draw calls (TASK-2.14)', () => {
  it('calls roundRect with x, y, width, height matching computeNoteBlockRect for a pitched note row', () => {
    const song = minimalSong();
    const n = note({ scaleDegree: 3, octave: 1, chromatic: 0, beat: 0, duration: 48 });
    song.measures[0].notes[0] = [n];
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const rect = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: n,
      isRest: false,
    });
    const { ctx, roundRect } = createNoteBlocksDrawContext();

    drawNoteBlocks(ctx, song, viewport);

    expect(roundRect).toHaveBeenCalledWith(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      NOTE_BLOCK_CORNER_RADIUS,
    );
    expect(rect.y).toBe(noteRowYFromNoteEvent(n, viewport.scrollY) + NOTE_BLOCK_VERTICAL_INSET);
  });

  it('shifts roundRect y by chromaticYOffset when chromatic is non-zero (PAT-018)', () => {
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const diatonic = note({ scaleDegree: 5, octave: 0, chromatic: 0, beat: 0, duration: 48 });
    const sharp = note({ scaleDegree: 5, octave: 0, chromatic: 1, beat: 0, duration: 48 });

    const songA = minimalSong();
    songA.measures[0].notes[0] = [diatonic];
    const { ctx: ctxA, roundRect: rrA } = createNoteBlocksDrawContext();
    drawNoteBlocks(ctxA, songA, viewport);

    const songB = minimalSong();
    songB.measures[0].notes[0] = [sharp];
    const { ctx: ctxB, roundRect: rrB } = createNoteBlocksDrawContext();
    drawNoteBlocks(ctxB, songB, viewport);

    const y0 = rrA.mock.calls[0]?.[1] as number;
    const y1 = rrB.mock.calls[0]?.[1] as number;
    expect(y1 - y0).toBe(chromaticYOffset(1));
  });

  it('renders a rest with fillRect for hatch fill and applies dashed outline via setLineDash', () => {
    const song = minimalSong();
    const n = note({
      scaleDegree: 1,
      octave: 0,
      chromatic: 0,
      beat: 0,
      duration: 96,
      isRest: true,
    });
    song.measures[0].notes[0] = [n];
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 40, zoom: 1 };
    const restRect = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: n,
      isRest: true,
    });
    const { ctx, fillRect, setLineDash } = createNoteBlocksDrawContext();

    drawNoteBlocks(ctx, song, viewport);

    expect(fillRect).toHaveBeenCalledWith(restRect.x, restRect.y, restRect.width, restRect.height);
    expect(setLineDash).toHaveBeenCalledWith([4, 3]);
  });
});
