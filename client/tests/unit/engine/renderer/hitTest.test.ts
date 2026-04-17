/*
 * QA COVERAGE PLAN — TASK-2.6
 *
 * Criterion 1: Chord Z-order (later beats / overlapping deterministic)
 *   happy: overlapping chords → later beat (topmost paint order) wins
 *   edge: non-overlapping region resolves to earlier chord only
 *
 * Criterion 2: Note row math matches noteRowYFromNoteEvent / computeNoteBlockRect
 *   happy: hit center of a pitched note block returns that note
 *   happy: rest uses same vertical anchor as renderer (REST_VERTICAL_ANCHOR)
 *   edge: chromatic offset shifts row per PAT-018
 *
 * Criterion 3: Misses return null (sentinel)
 *   happy: measure header band, empty strips, off-canvas x → null
 *
 * Criterion 4: No React — pure TypeScript module
 *   happy: hitTest.ts source contains no react import (when file exists)
 *
 * Criterion 5: npm test passes when implementation lands
 *   (verified by CI / Builder; this file is the contract suite)
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ChordEvent, Measure, NoteEvent, SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  MEASURE_HEADER_HEIGHT,
  MELODY_DIATONIC_ROW_COUNT,
  NOTE_HEIGHT,
  computeNoteBlockRect,
  layoutChordBlock,
} from '../../../../src/engine/renderer/index';
import type { EditorCanvasHit } from '../../../../src/engine/renderer/hitTest';
import { hitTestEditorCanvas } from '../../../../src/engine/renderer/hitTest';

const _here = dirname(fileURLToPath(import.meta.url));
const hitTestSourcePath = join(_here, '../../../../src/engine/renderer/hitTest.ts');

function emptyMeasure(id: string): Measure {
  return { id, chords: [], notes: [[], [], [], []] };
}

function chord(partial: Partial<ChordEvent> & Pick<ChordEvent, 'scaleDegree' | 'quality' | 'id'>): ChordEvent {
  return {
    id: partial.id,
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

function note(partial: Partial<NoteEvent> & Pick<NoteEvent, 'id' | 'beat' | 'duration'>): NoteEvent {
  return {
    id: partial.id,
    scaleDegree: partial.scaleDegree ?? 1,
    octave: partial.octave ?? 0,
    chromatic: partial.chromatic ?? 0,
    beat: partial.beat,
    duration: partial.duration,
    isRest: partial.isRest ?? false,
    velocity: partial.velocity ?? 100,
  };
}

function minimalSong(measures: Measure[]): SongData {
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

function vp(overrides: Partial<Viewport> = {}): Viewport {
  return {
    startMeasure: 0,
    measureCount: 8,
    scrollY: 0,
    zoom: 1,
    ...overrides,
  };
}

function centerOf(rect: { x: number; y: number; width: number; height: number }): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

describe('hit testing (TASK-2.6) — chord Z-order', () => {
  it('returns the later-beat chord when two chord rects overlap in the chord strip', () => {
    const cEarly = chord({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      scaleDegree: 1,
      quality: 'major',
      beat: 0,
      duration: 144,
    });
    const cLate = chord({
      id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      scaleDegree: 4,
      quality: 'major',
      beat: 96,
      duration: 48,
    });
    const song = minimalSong([
      {
        ...emptyMeasure('m0'),
        chords: [cEarly, cLate],
      },
    ]);
    const viewport = vp({ measureCount: 1 });
    const lateRect = layoutChordBlock(cLate, 0, song, viewport);
    const p = centerOf(lateRect);

    const hit = hitTestEditorCanvas(p.x, p.y, song, viewport);
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('chord');
    const ch = hit as Extract<EditorCanvasHit, { kind: 'chord' }>;
    expect(ch.chord.id).toBe(cLate.id);
  });

  it('returns the earlier chord when the point lies only under the first chord’s span', () => {
    const cEarly = chord({
      id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
      scaleDegree: 2,
      quality: 'minor',
      beat: 0,
      duration: 144,
    });
    const cLate = chord({
      id: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
      scaleDegree: 5,
      quality: 'major',
      beat: 96,
      duration: 48,
    });
    const song = minimalSong([
      {
        ...emptyMeasure('m0'),
        chords: [cEarly, cLate],
      },
    ]);
    const viewport = vp({ measureCount: 1 });
    const earlyRect = layoutChordBlock(cEarly, 0, song, viewport);
    // Left third of the early block only (tick ~24 from start of early block — before late block starts at beat 96)
    const p = { x: earlyRect.x + earlyRect.width * 0.15, y: earlyRect.y + earlyRect.height / 2 };

    const hit = hitTestEditorCanvas(p.x, p.y, song, viewport);
    expect(hit?.kind).toBe('chord');
    const ch = hit as Extract<EditorCanvasHit, { kind: 'chord' }>;
    expect(ch.chord.id).toBe(cEarly.id);
  });
});

describe('hit testing (TASK-2.6) — note row math vs noteRowYFromNoteEvent', () => {
  it('hits a pitched note at the center of computeNoteBlockRect (same geometry as renderer)', () => {
    const n = note({
      id: 'note1111-1111-4111-8111-111111111111',
      scaleDegree: 3,
      octave: 1,
      chromatic: 0,
      beat: 48,
      duration: 48,
    });
    const song = minimalSong([
      {
        ...emptyMeasure('m0'),
        notes: [[n], [], [], []],
      },
    ]);
    const viewport = vp({ measureCount: 1, scrollY: 40 });
    const rect = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: n,
      isRest: false,
    });
    const p = centerOf(rect);

    const hit = hitTestEditorCanvas(p.x, p.y, song, viewport);
    expect(hit?.kind).toBe('note');
    const nh = hit as Extract<EditorCanvasHit, { kind: 'note' }>;
    expect(nh.note.id).toBe(n.id);
    expect(nh.voiceIndex).toBe(0);
    expect(nh.measureIndex).toBe(0);
  });

  it('places rests on the REST_VERTICAL_ANCHOR row so the hit matches the rest block rect', async () => {
    const { REST_VERTICAL_ANCHOR } = await import('../../../../src/engine/renderer/noteBlocks');
    const n = note({
      id: 'rest2222-2222-4222-8222-222222222222',
      scaleDegree: 1,
      octave: 2,
      chromatic: 0,
      beat: 0,
      duration: 96,
      isRest: true,
    });
    const song = minimalSong([
      {
        ...emptyMeasure('m0'),
        notes: [[n], [], [], []],
      },
    ]);
    const viewport = vp({ measureCount: 1, scrollY: 55 });
    const rect = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: n,
      isRest: true,
    });
    expect(n.scaleDegree).not.toBe(REST_VERTICAL_ANCHOR.scaleDegree);
    const p = centerOf(rect);

    const hit = hitTestEditorCanvas(p.x, p.y, song, viewport);
    expect(hit?.kind).toBe('note');
    const nh = hit as Extract<EditorCanvasHit, { kind: 'note' }>;
    expect(nh.note.isRest).toBe(true);
    expect(nh.note.id).toBe(n.id);
  });

  it('applies chromatic vertical offset consistently with computeNoteBlockRect (PAT-018)', () => {
    const base = note({
      id: '33333333-3333-4333-8333-333333333333',
      scaleDegree: 5,
      octave: 0,
      chromatic: 0,
      beat: 0,
      duration: 24,
    });
    const sharp = { ...base, id: '44444444-4444-4444-8444-444444444444', chromatic: 1 };
    const song = minimalSong([
      {
        ...emptyMeasure('m0'),
        notes: [[base, sharp], [], [], []],
      },
    ]);
    const viewport = vp({ measureCount: 1 });
    const rSharp = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: sharp,
      isRest: false,
    });
    const p = centerOf(rSharp);

    const hit = hitTestEditorCanvas(p.x, p.y, song, viewport);
    expect(hit?.kind).toBe('note');
    expect((hit as Extract<EditorCanvasHit, { kind: 'note' }>).note.id).toBe(sharp.id);
  });

  it('stays geometrically aligned with layoutChordBlock when custom melody row heights are used', () => {
    const c = chord({
      id: 'f0f0f0f0-f0f0-4f0f-f0f0-f0f0f0f0f0f0',
      scaleDegree: 4,
      quality: 'minor',
      beat: 24,
      duration: 96,
    });
    const song = minimalSong([
      {
        ...emptyMeasure('m0'),
        chords: [c],
      },
    ]);
    const viewport = vp({ measureCount: 1 });
    const rowHeight = 34;

    const rect = layoutChordBlock(c, 0, song, viewport, rowHeight);
    const hitInside = hitTestEditorCanvas(rect.x + rect.width / 2, rect.y + rect.height / 2, song, viewport, rowHeight);
    expect(hitInside).not.toBeNull();
    expect(hitInside?.kind).toBe('chord');
    expect((hitInside as Extract<EditorCanvasHit, { kind: 'chord' }>).chord.id).toBe(c.id);

    const hitEdge = hitTestEditorCanvas(rect.x + rect.width / 2, rect.y + rect.height, song, viewport, rowHeight);
    expect(hitEdge).toBeNull();
  });

  it('requires matching melodyRowHeight for stable chord-strip hit semantics', () => {
    const c = chord({
      id: 'h0h0h0h0-h0h0-4h0h-h0h0-h0h0h0h0h0h0',
      scaleDegree: 2,
      quality: 'major',
      beat: 24,
      duration: 96,
    });
    const song = minimalSong([
      {
        ...emptyMeasure('m0'),
        chords: [c],
      },
    ]);
    const viewport = vp({ measureCount: 1 });
    const rowHeight = 34;
    const rect = layoutChordBlock(c, 0, song, viewport, rowHeight);

    const hitDefaultRowHeight = hitTestEditorCanvas(rect.x + rect.width / 2, rect.y + rect.height / 2, song, viewport);
    expect(hitDefaultRowHeight).toBeNull();

    const hitAligned = hitTestEditorCanvas(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      song,
      viewport,
      rowHeight,
    );
    expect(hitAligned).not.toBeNull();
    expect((hitAligned as Extract<EditorCanvasHit, { kind: 'chord' }>).chord.id).toBe(c.id);
  });
});

describe('hit testing (TASK-2.6) — note voice overlap Z-order', () => {
  it('prefers the higher voice index when two voices share the same block geometry', () => {
    const shared = {
      scaleDegree: 3 as const,
      octave: 0,
      chromatic: 0,
      beat: 24,
      duration: 48,
    };
    const n0 = note({ id: 'aaaaaaaa-0000-4000-8000-000000000001', ...shared });
    const n3 = note({ id: 'aaaaaaaa-0000-4000-8000-000000000003', ...shared });
    const song = minimalSong([
      {
        ...emptyMeasure('m0'),
        notes: [[n0], [], [], [n3]],
      },
    ]);
    const viewport = vp({ measureCount: 1 });
    const rect = computeNoteBlockRect({
      song,
      viewport,
      measureIndex: 0,
      note: n3,
      isRest: false,
      voiceIndex: 3,
    });
    const p = centerOf(rect);

    const hit = hitTestEditorCanvas(p.x, p.y, song, viewport);
    expect(hit?.kind).toBe('note');
    expect((hit as Extract<EditorCanvasHit, { kind: 'note' }>).voiceIndex).toBe(3);
    expect((hit as Extract<EditorCanvasHit, { kind: 'note' }>).note.id).toBe(n3.id);
  });
});

describe('hit testing (TASK-2.6) — misses return null', () => {
  it('returns null for y in the measure header band (above chord strip)', () => {
    const song = minimalSong([
      {
        ...emptyMeasure('m0'),
        chords: [
          chord({
            id: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
            scaleDegree: 1,
            quality: 'major',
            beat: 0,
            duration: 192,
          }),
        ],
      },
    ]);
    const viewport = vp({ measureCount: 1 });
    const rect = layoutChordBlock(song.measures[0].chords[0], 0, song, viewport);

    const hit = hitTestEditorCanvas(rect.x + 10, MEASURE_HEADER_HEIGHT / 2, song, viewport);
    expect(hit).toBeNull();
  });

  it('returns null in the chord strip when there are no chords in visible measures', () => {
    const song = minimalSong([emptyMeasure('m0')]);
    const viewport = vp({ measureCount: 1 });
    const stripTop = MEASURE_HEADER_HEIGHT + MELODY_DIATONIC_ROW_COUNT * NOTE_HEIGHT;
    const y = stripTop + 10;

    expect(hitTestEditorCanvas(80, y, song, viewport)).toBeNull();
  });

  it('returns null in the note staff when there are no notes under the point', () => {
    const song = minimalSong([emptyMeasure('m0')]);
    const viewport = vp({ measureCount: 1 });
    const y = MEASURE_HEADER_HEIGHT + 80;

    expect(hitTestEditorCanvas(50, y, song, viewport)).toBeNull();
  });

  it('returns null for viewport x far past the laid-out measures (no block there)', () => {
    const song = minimalSong([emptyMeasure('m0')]);
    const viewport = vp({ measureCount: 1 });

    const hit = hitTestEditorCanvas(5000, MEASURE_HEADER_HEIGHT + 50, song, viewport);
    expect(hit).toBeNull();
  });
});

describe('hit testing (TASK-2.6) — pure module (no React)', () => {
  it('hitTest.ts does not import react', () => {
    if (!existsSync(hitTestSourcePath)) {
      expect.fail('client/src/engine/renderer/hitTest.ts is missing — add the hit-testing module.');
    }
    const src = readFileSync(hitTestSourcePath, 'utf8');
    expect(src).not.toMatch(/from\s+['"]react['"]/);
    expect(src).not.toMatch(/from\s+['"]react-dom['"]/);
  });
});
