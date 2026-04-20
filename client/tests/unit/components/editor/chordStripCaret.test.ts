import type { SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  chordStripCaretSelectionFromPointer,
  melodyGridCaretSelectionFromPointer,
  tableInsertBeatFromSelection,
} from '../../../../src/components/editor/editorKeyboardLogic';
import {
  CHORD_AREA_HEIGHT,
  CHORD_LETTER_STRIP_HEIGHT,
  MEASURE_HEADER_HEIGHT,
  MELODY_DIATONIC_ROW_COUNT,
  NOTE_HEIGHT,
} from '../../../../src/engine/renderer/constants';
import { horizontalTicksToPx } from '../../../../src/engine/renderer/layout';
import { buildDefaultSong } from '../../../../src/store/songStore';

/** E2E `persistence.happy` — chord strip vertical center (PAT-012 bottom strip, RA-2). */
const E2E_CHORD_STRIP_CENTER_Y =
  MEASURE_HEADER_HEIGHT +
  MELODY_DIATONIC_ROW_COUNT * NOTE_HEIGHT +
  CHORD_AREA_HEIGHT +
  CHORD_LETTER_STRIP_HEIGHT / 2;

const DEFAULT_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};

describe('chordStripCaretSelectionFromPointer', () => {
  it('returns collapsed range caret in chord band for E2E-like x/y on an empty song', () => {
    const song: SongData = buildDefaultSong();
    const w = 800;
    const x = Math.min(Math.max(40, w * 0.1), w - 4);
    const y = Math.min(Math.max(28, E2E_CHORD_STRIP_CENTER_Y), 600 - 4);

    const sel = chordStripCaretSelectionFromPointer(song, DEFAULT_VIEWPORT, x, y);
    expect(sel).toEqual({
      type: 'range',
      measureIndex: 0,
      rangeStart: 0,
      rangeEnd: 0,
    });
  });

  it('returns null above the chord strip (measure header)', () => {
    const song = buildDefaultSong();
    expect(chordStripCaretSelectionFromPointer(song, DEFAULT_VIEWPORT, 80, MEASURE_HEADER_HEIGHT / 2)).toBeNull();
  });

  it('returns null in the staff area', () => {
    const song = buildDefaultSong();
    expect(chordStripCaretSelectionFromPointer(song, DEFAULT_VIEWPORT, 80, MEASURE_HEADER_HEIGHT + 80)).toBeNull();
  });
});

describe('melodyGridCaretSelectionFromPointer', () => {
  it('returns a snapped collapsed range caret on staff-area click', () => {
    const song = buildDefaultSong();
    const viewport = DEFAULT_VIEWPORT;
    const sel = melodyGridCaretSelectionFromPointer(
      song,
      viewport,
      horizontalTicksToPx(95, viewport.zoom),
      MEASURE_HEADER_HEIGHT + 1,
    );
    expect(sel).toEqual({
      type: 'range',
      measureIndex: 0,
      rangeStart: 96,
      rangeEnd: 96,
    });
  });

  it('maps viewport X with startMeasure offset to the expected measure beat pair', () => {
    const song = buildDefaultSong();
    const viewport = { ...DEFAULT_VIEWPORT, startMeasure: 2 };
    const sel = melodyGridCaretSelectionFromPointer(
      song,
      viewport,
      horizontalTicksToPx(96, viewport.zoom),
      MEASURE_HEADER_HEIGHT + 1,
    );
    expect(sel).toEqual({
      type: 'range',
      measureIndex: 2,
      rangeStart: 96,
      rangeEnd: 96,
    });
  });
});

describe('tableInsertBeatFromSelection', () => {
  it('uses collapsed range beat from table caret when measure matches (chords)', () => {
    const song = buildDefaultSong();
    const selection = { type: 'range', measureIndex: 0, rangeStart: 96, rangeEnd: 96 };
    expect(tableInsertBeatFromSelection(selection, song, 0, 'chord', 0)).toBe(96);
  });

  it('uses collapsed range beat from table caret when measure matches (notes)', () => {
    const song = buildDefaultSong();
    const selection = { type: 'range', measureIndex: 0, rangeStart: 96, rangeEnd: 96 };
    expect(tableInsertBeatFromSelection(selection, song, 0, 'note', 0)).toBe(96);
  });
});
