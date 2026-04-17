/*
 * QA COVERAGE PLAN — UI-W1 (RA-1, RA-3)
 *
 * Criterion 1 — Seeded song: distinct pitch rows + bar width ∝ duration
 *   happy: multiple degrees/octaves in one measure → different computeNoteBlockRect.y; width = duration × pixelsPerTick
 *   error: —
 *   edges: zoom ≠ 1; chromatic offset
 *
 * Criterion 2 — Vertical pitch labels for rows in view (UX §2 structure)
 *   happy: computePitchAxisLabelsInViewport returns non-empty with primary glyphs for visible rows
 *   error: stub returns [] until gutter is implemented (expected FAIL until Builder)
 *   edges: scrollY shifts which rows are “in view” for labeling
 *
 * Criterion 3 — scrollY coherent with pointer / viewport transforms
 *   happy: viewportYToStaffRelativeY(noteRowY + inset, scrollY) recovers staff-relative row position
 *   edges: scrollY 0 vs non-zero
 *
 * Criterion 4 — hitTestEditorCanvas aligns with computeNoteBlockRect
 *   happy: center of rect hits the note; uses same melodyRowHeight
 *
 * Criterion 5 — notes are wide duration bars, not uniform tiles
 *   happy: width scales with duration; long note width ≫ NOTE_HEIGHT
 *
 * Related existing coverage: noteBlocks.test.ts, hitTest.test.ts, layout.test.ts
 */

import type { Measure, NoteEvent, SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  NOTE_HEIGHT,
  absoluteTickToViewportX,
  noteRowYFromNoteEvent,
  noteStaffTopY,
  pixelsPerTick,
} from '../../../../src/engine/renderer/layout';
import { CHORD_AREA_HEIGHT, CHORD_LETTER_STRIP_HEIGHT } from '../../../../src/engine/renderer/constants';
import { computeNoteBlockRect } from '../../../../src/engine/renderer/noteBlocks';
import { computePitchAxisLabelsInViewport, midiToScientificPitchLabel } from '../../../../src/engine/renderer/pitchAxisLayout';
import { hitTestEditorCanvas } from '../../../../src/engine/renderer/hitTest';
import {
  degreeOctaveToDiatonicRow,
  viewportYToStaffRelativeY,
} from '../../../../src/components/editor/pointerMath';

function emptyMeasure(id: string): Measure {
  return { id, chords: [], notes: [[], [], [], []] };
}

function minimalSong(measureCount = 4): SongData {
  const measures: Measure[] = [];
  for (let i = 0; i < measureCount; i++) {
    measures.push(emptyMeasure(`10000000-0000-4000-8000-00000000000${i}`));
  }
  return {
    version: '1.0',
    metadata: {
      title: 'UI-W1',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures,
    bandConfig: { tracks: [] },
  };
}

function note(partial: Partial<NoteEvent> & Pick<NoteEvent, 'beat' | 'duration' | 'id'>): NoteEvent {
  return {
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    velocity: 100,
    isRest: false,
    ...partial,
  };
}

/** Matches EditorCanvas STAFF_DIATONIC_ROWS — melody band height in diatonic steps at default spacing. */
const MELODY_DIATONIC_ROWS = 28;

function defaultMelodyCanvasHeight(melodyRowHeight: number): number {
  return noteStaffTopY() + MELODY_DIATONIC_ROWS * melodyRowHeight + CHORD_AREA_HEIGHT + CHORD_LETTER_STRIP_HEIGHT;
}

describe('UI-W1 — piano roll pitch gutter labels (criterion 2)', () => {
  describe('happy path', () => {
    it('returns at least one non-empty primary label when the melody band is visible (scrollY = 0)', () => {
      const song = minimalSong(1);
      const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
      const h = defaultMelodyCanvasHeight(NOTE_HEIGHT);
      const labels = computePitchAxisLabelsInViewport(song, viewport, h, NOTE_HEIGHT);
      expect(labels.length).toBeGreaterThan(0);
      expect(labels.some((l) => l.primary.trim().length > 0)).toBe(true);
    });

  it('RA-206: pitch labels contain only pitch letters (no octave digits)', () => {
    const song = minimalSong(1);
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const labels = computePitchAxisLabelsInViewport(song, viewport, defaultMelodyCanvasHeight(NOTE_HEIGHT), NOTE_HEIGHT);
    for (const row of labels) {
      expect(row.primary).toMatch(/^[A-G](?:[#♯♭b])?$/);
      expect(row.primary).not.toMatch(/\d/);
    }
  });

    it('labels each visible row with a bounded primary string (UX §2 canvas label structure)', () => {
      const song = minimalSong(1);
      const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
      const labels = computePitchAxisLabelsInViewport(song, viewport, defaultMelodyCanvasHeight(NOTE_HEIGHT), NOTE_HEIGHT);
      expect(labels.length).toBeGreaterThan(0);
      for (const row of labels) {
        expect(row.primary.length).toBeGreaterThan(0);
        expect(row.primary.length).toBeLessThanOrEqual(16);
        expect(row.primary).not.toMatch(/\d/);
        expect(row.centerY).toBeGreaterThanOrEqual(noteStaffTopY());
        expect(row.centerY).toBeLessThan(defaultMelodyCanvasHeight(NOTE_HEIGHT));
      }
    });

  it('RA-206: midiToScientificPitchLabel returns note text without octave numbers', () => {
    expect(midiToScientificPitchLabel(60)).toBe('C');
    expect(midiToScientificPitchLabel(61)).toBe('C♯');
    expect(midiToScientificPitchLabel(62)).toBe('D');
    expect(midiToScientificPitchLabel(71)).toBe('B');
  });
  });

  it('uses flat spellings from active key/scale context (RA-206)', () => {
    const song = minimalSong(1);
    song.measures[0] = {
      ...song.measures[0],
      changes: { key: 'C', scale: 'minor' },
    };
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const labels = computePitchAxisLabelsInViewport(song, viewport, defaultMelodyCanvasHeight(NOTE_HEIGHT), NOTE_HEIGHT);
    const degree3Row = labels.find((row) => row.diatonicRowIndex === 2);
    expect(degree3Row?.primary).toBe('E♭');
  });

  describe('edge cases', () => {
    it('after vertical scroll, still exposes labels for rows intersecting the melody viewport', () => {
      const song = minimalSong(1);
      const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 120, zoom: 1 };
      const labels = computePitchAxisLabelsInViewport(song, viewport, defaultMelodyCanvasHeight(NOTE_HEIGHT), NOTE_HEIGHT);
      expect(labels.length).toBeGreaterThan(0);
    });
  });
});

describe('UI-W1 — pitch label spelling helpers (RA-206)', () => {
  it('prefers non-sharp naming when context is unavailable (default flat-first spelling)', () => {
    expect(midiToScientificPitchLabel(1)).toBe('D♭');
    expect(midiToScientificPitchLabel(3)).toBe('E♭');
  });
});

describe('UI-W1 — seeded melody geometry: rows + duration bars (criteria 1 & 5)', () => {
  it('places notes at different scale degrees on distinct horizontal rows with width proportional to duration', () => {
    const song = minimalSong(1);
    song.measures[0]!.notes[0] = [
      note({ id: 'a', scaleDegree: 1, octave: 0, beat: 0, duration: 48 }),
      note({ id: 'b', scaleDegree: 4, octave: 0, beat: 48, duration: 24 }),
      note({ id: 'c', scaleDegree: 7, octave: 1, beat: 96, duration: 96 }),
    ];
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };

    const r1 = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: song.measures[0]!.notes[0]![0]!,
      isRest: false,
    });
    const r4 = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: song.measures[0]!.notes[0]![1]!,
      isRest: false,
    });
    const r7 = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: song.measures[0]!.notes[0]![2]!,
      isRest: false,
    });

    expect(new Set([r1.y, r4.y, r7.y]).size).toBe(3);
    expect(r1.width).toBe(48 * pixelsPerTick(1));
    expect(r4.width).toBe(24 * pixelsPerTick(1));
    expect(r7.width).toBe(96 * pixelsPerTick(1));
  });

  it('renders duration as a wide horizontal bar (width ≫ row height) for a half note at zoom 1', () => {
    const song = minimalSong(1);
    const n = note({ id: 'wide', scaleDegree: 3, octave: 0, beat: 0, duration: 96 });
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const r = computeNoteBlockRect({ song, viewport, measureIndex: 0, note: n, isRest: false });
    expect(r.width).toBeGreaterThan(r.height * 3);
  });
});

describe('UI-W1 — scrollY / pointer coherence (criterion 3)', () => {
  it('maps viewport Y at the note row top to staff-relative Y consistent with diatonicRowIndex + PAT-018 chromatic offset', () => {
    const n = note({ id: 'p', scaleDegree: 5, octave: 0, chromatic: -1, beat: 0, duration: 48 });
    const song = minimalSong(1);
    const scrollY = 80;
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY, zoom: 1 };
    const rowTopY = noteRowYFromNoteEvent(n, scrollY);
    const rel = viewportYToStaffRelativeY(rowTopY, scrollY);
    const row = degreeOctaveToDiatonicRow(n.scaleDegree, n.octave);
    const expectedRel = row * NOTE_HEIGHT + n.chromatic * (NOTE_HEIGHT / 2);
    expect(rel).toBeCloseTo(expectedRel, 5);
  });
});

describe('UI-W1 — hit targets match computeNoteBlockRect (criterion 4)', () => {
  it('returns the note when hit-testing the center of its computeNoteBlockRect', () => {
    const song = minimalSong(1);
    const n = note({ id: 'hit', scaleDegree: 2, octave: 0, beat: 24, duration: 48 });
    song.measures[0]!.notes[0] = [n];
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1 };
    const rect = computeNoteBlockRect({ song, viewport, measureIndex: 0, note: n, isRest: false });
    const hit = hitTestEditorCanvas(rect.x + rect.width / 2, rect.y + rect.height / 2, song, viewport, NOTE_HEIGHT);
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('note');
    if (hit?.kind === 'note') {
      expect(hit.note.id).toBe('hit');
    }
  });

  it('maps horizontal hit position to the same tick span as the rect (viewport X ↔ absolute tick)', () => {
    const song = minimalSong(1);
    const n = note({ id: 'x', scaleDegree: 1, octave: 0, beat: 48, duration: 48 });
    song.measures[0]!.notes[0] = [n];
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 1.5 };
    const rect = computeNoteBlockRect({ song, viewport, measureIndex: 0, note: n, isRest: false });
    expect(rect.x).toBe(absoluteTickToViewportX(48, viewport, song));
    expect(rect.width).toBe(48 * pixelsPerTick(1.5));
  });
});
