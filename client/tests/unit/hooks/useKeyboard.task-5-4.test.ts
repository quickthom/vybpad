/** @vitest-environment jsdom */
/**
 * TASK-5.4 — `i` / `e` on single chord selection (UX §8 keyboard; help modal deferred).
 */
import type { ChordEvent, Selection, SongData, Viewport } from '@vybpad/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleEditorKeydown, type EditorKeyboardContext } from '../../../src/hooks/useKeyboard';
import { useSongStore } from '../../../src/store/songStore';

const viewport: Viewport = { startMeasure: 0, measureCount: 8, scrollY: 0, zoom: 1 };

function chordTemplate(id: string, over: Partial<ChordEvent> = {}): ChordEvent {
  return {
    id,
    scaleDegree: 1,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat: 0,
    duration: 48,
    ...over,
  };
}

function songWithOneChord(ch: ChordEvent): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'T',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: 'm0',
        chords: [ch],
        notes: [[], [], [], []],
      },
    ],
    bandConfig: {
      tracks: [
        { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
        { role: 'melody2', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
        { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
        { role: 'drums', instrument: 'piano', volume: 0.0, mute: true, octave: 0 },
      ],
    },
  };
}

function baseCtx(over: Partial<EditorKeyboardContext>): EditorKeyboardContext {
  return {
    song: over.song!,
    viewport,
    selection: over.selection ?? null,
    activeVoice: 0,
    entryMode: 'table',
    currentDurationTicks: 48,
    setCurrentDurationTicks: over.setCurrentDurationTicks ?? vi.fn(),
    keyboardTargetMeasureRef: { current: null },
    textDurationArmedRef: { current: false },
    getSongAfterMutation: over.getSongAfterMutation,
    getSelectionAfterMutation: over.getSelectionAfterMutation,
    onChordEdit: over.onChordEdit!,
    onNoteEdit: over.onNoteEdit ?? vi.fn(),
    onSelectionChange: over.onSelectionChange ?? vi.fn(),
    ...over,
  } as EditorKeyboardContext;
}

describe('useKeyboard — TASK-5.4 — i / e single chord', () => {
  it('no-op i/e when selection is not a single chord (range / note / two ids)', () => {
    const onChordEdit = vi.fn();
    const cid = '11111111-1111-4111-8111-111111111111';
    const song = songWithOneChord(chordTemplate(cid));

    const rangeSel: Selection = { type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 };
    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'i' }), baseCtx({ song, selection: rangeSel, onChordEdit }));
    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'e' }), baseCtx({ song, selection: rangeSel, onChordEdit }));
    expect(onChordEdit).not.toHaveBeenCalled();

    const noteSel: Selection = { type: 'note', measureIndex: 0, eventIds: ['n1'] };
    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'i' }), baseCtx({ song, selection: noteSel, onChordEdit }));
    expect(onChordEdit).not.toHaveBeenCalled();

    const twoChord: Selection = { type: 'chord', measureIndex: 0, eventIds: [cid, 'other'] };
    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'e' }), baseCtx({ song, selection: twoChord, onChordEdit }));
    expect(onChordEdit).not.toHaveBeenCalled();
  });

  it('i updates inversion via ChordEditAction update; e advances embellishment (not duration)', () => {
    const cid = '22222222-2222-4222-8222-222222222222';
    const onChordEdit = vi.fn();
    const song = songWithOneChord(chordTemplate(cid, { seventh: 'dom7', inversion: 2 }));
    const sel: Selection = { type: 'chord', measureIndex: 0, eventIds: [cid] };

    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'i' }), baseCtx({ song, selection: sel, onChordEdit }));
    expect(onChordEdit).toHaveBeenCalledWith(0, {
      type: 'update',
      chordId: cid,
      changes: { inversion: 3 },
    });

    onChordEdit.mockClear();
    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'e' }), baseCtx({ song, selection: sel, onChordEdit }));
    expect(onChordEdit).toHaveBeenCalledWith(0, {
      type: 'update',
      chordId: cid,
      changes: expect.objectContaining({ seventh: 'dim7', suspension: 'none', addition: 'none' }),
    });
  });
});

describe('useKeyboard — TASK-5.4 — undo after i', () => {
  beforeEach(() => {
    useSongStore.getState().loadSong(
      songWithOneChord(chordTemplate('33333333-3333-4333-8333-333333333333', { inversion: 0 })),
    );
  });

  it('undo restores inversion after i (PAT-005 / store editChord)', () => {
    const sel: Selection = { type: 'chord', measureIndex: 0, eventIds: ['33333333-3333-4333-8333-333333333333'] };
    handleEditorKeydown(
      new KeyboardEvent('keydown', { key: 'i' }),
      baseCtx({
        song: useSongStore.getState().song,
        selection: sel,
        getSongAfterMutation: () => useSongStore.getState().song,
        onChordEdit: (mi, a) => useSongStore.getState().editChord(mi, a),
      }),
    );
    expect(useSongStore.getState().song.measures[0].chords[0].inversion).toBe(1);
    useSongStore.getState().undo();
    expect(useSongStore.getState().song.measures[0].chords[0].inversion).toBe(0);
  });
});
