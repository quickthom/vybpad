/*
 * QA COVERAGE PLAN — TASK-7.4 (INTERFACES.md SongStore clipboard + PAT-028)
 *
 * Criterion 1: Non-empty copyable selection → buildSelectionClipboardPayload has version 1,
 *   source vybpad, kind selection, measure slices per contract; serialized text is valid JSON.
 *   happy: chord (and/or notes) in selection → non-null payload, fields + slice content match song
 *   error: —
 *   edges: ISO copiedAt parseable; JSON.stringify round-trips; minified JSON has no newlines
 *
 * Criterion 2: Paste rejects unknown version or non-vYbpad / wrong kind with no-op (no throw, no song change).
 *   happy: —
 *   error: version ≠ 1; source ≠ vybpad; kind ≠ selection → song unchanged vs snapshot
 *   edges: —
 *
 * Criterion 3: Paste merges at destination per contract; empty clipboard / parse errors no-op.
 *   happy: after copy, move UI selection to destination measure, apply → copied material appears at destination
 *   error: —
 *   edges: selection null → build returns null (nothing copyable). Note: JSON parse / empty string are handled
 *     before SongStore.apply in the clipboard transport layer (INTERFACES § Clipboard transport); this file tests
 *     the store contract only.
 *
 * Criterion 4: Undo/redo where store mutations apply — paste is a mutation with undo entry.
 *   happy: undo after paste restores prior song; redo reapplies
 *   error: —
 *   edges: —
 *
 * Criterion 5: Vitest unit scope (no Playwright) — matches ARCHITECTURE.md state-management tests.
 */
import type { ChordEvent, MeasureChanges, NoteEvent, SongData } from '@vybpad/shared';
import type { Selection } from '@vybpad/shared';
import { randomUUID } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { useSongStore } from '../../../src/store/songStore';
import { useUIStore } from '../../../src/store/uiStore';

/** INTERFACES.md — ClipboardMeasureSlice */
interface ClipboardMeasureSlice {
  measureOffset: number;
  chords: ChordEvent[];
  notes: NoteEvent[][];
  changes?: MeasureChanges;
}

/** INTERFACES.md — SelectionClipboardPayload */
interface SelectionClipboardPayload {
  version: 1;
  kind: 'selection';
  source: 'vybpad';
  copiedAt: string;
  selection: Selection;
  measures: ClipboardMeasureSlice[];
}

/** TASK-7.4 clipboard surface (SongStore) — cast until implementation is merged into `useSongStore` typing. */
type SongStoreClipboardApi = {
  buildSelectionClipboardPayload: () => SelectionClipboardPayload | null;
  applySelectionClipboardPayload: (payload: SelectionClipboardPayload) => void;
};

function songClipboard(): SongStoreClipboardApi {
  return useSongStore.getState() as unknown as SongStoreClipboardApi;
}

function makeDefaultSong(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'Untitled',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: Array.from({ length: 8 }, () => ({
      id: randomUUID(),
      chords: [],
      notes: [[], [], [], []] as SongData['measures'][0]['notes'],
      changes: undefined,
    })),
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

function baseChord(): Omit<ChordEvent, 'id'> {
  return {
    scaleDegree: 4,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat: 0,
    duration: 48,
  };
}

describe('TASK-7.4 — SongStore clipboard JSON (buildSelectionClipboardPayload)', () => {
  beforeEach(() => {
    useSongStore.getState().loadSong(makeDefaultSong());
    useUIStore.getState().setSelection(null);
  });

  describe('happy path', () => {
    it('returns a SelectionClipboardPayload with version 1, source vybpad, kind selection, copiedAt ISO-8601, and measures slices matching the song for a non-empty chord selection', () => {
      useSongStore.getState().editChord(0, {
        type: 'add',
        chord: baseChord(),
      });
      const chordId = useSongStore.getState().song.measures[0].chords[0].id;

      const sel: Selection = { type: 'chord', measureIndex: 0, eventIds: [chordId] };
      useUIStore.getState().setSelection(sel);

      const payload = songClipboard().buildSelectionClipboardPayload();
      expect(payload).not.toBeNull();

      expect(payload!.version).toBe(1);
      expect(payload!.source).toBe('vybpad');
      expect(payload!.kind).toBe('selection');
      expect(Number.isNaN(Date.parse(payload!.copiedAt))).toBe(false);
      expect(payload!.selection).toEqual(sel);

      expect(payload!.measures.length).toBeGreaterThanOrEqual(1);
      const first = payload!.measures[0];
      expect(first.measureOffset).toBe(0);
      expect(first.chords.some((c) => c.id === chordId && c.scaleDegree === 4)).toBe(true);
      expect(first.notes).toEqual([[], [], [], []]);
    });

    it('serializes to valid minified JSON (no newlines in JSON.stringify) that round-trips with JSON.parse', () => {
      useSongStore.getState().editChord(1, {
        type: 'add',
        chord: { ...baseChord(), beat: 24 },
      });
      const chordId = useSongStore.getState().song.measures[1].chords[0].id;
      useUIStore.getState().setSelection({
        type: 'chord',
        measureIndex: 1,
        eventIds: [chordId],
      });

      const payload = songClipboard().buildSelectionClipboardPayload();
      expect(payload).not.toBeNull();

      const text = JSON.stringify(payload);
      expect(text.includes('\n')).toBe(false);
      const round = JSON.parse(text) as SelectionClipboardPayload;
      expect(round.version).toBe(1);
      expect(round.source).toBe('vybpad');
      expect(round.kind).toBe('selection');
      expect(round.measures.length).toBe(payload!.measures.length);
    });

    it('includes one ClipboardMeasureSlice per copied measure with measureOffset 0..N-1 for a two-measure range selection', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChord() });
      const c0 = useSongStore.getState().song.measures[0].chords[0].id;
      useSongStore.getState().editChord(1, {
        type: 'add',
        chord: { ...baseChord(), scaleDegree: 5, beat: 0 },
      });
      const c1 = useSongStore.getState().song.measures[1].chords[0].id;

      // 4/4 → 192 ticks per measure; span first two measures (0..383 inclusive ticks).
      useUIStore.getState().setSelection({
        type: 'range',
        measureIndex: 0,
        rangeStart: 0,
        rangeEnd: 383,
      });

      const payload = songClipboard().buildSelectionClipboardPayload();
      expect(payload).not.toBeNull();
      expect(payload!.measures).toHaveLength(2);
      expect(payload!.measures.map((m) => m.measureOffset)).toEqual([0, 1]);
      expect(payload!.measures[0].chords.some((c) => c.id === c0)).toBe(true);
      expect(payload!.measures[1].chords.some((c) => c.id === c1)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns null from buildSelectionClipboardPayload when UI selection is null (nothing copyable)', () => {
      useUIStore.getState().setSelection(null);
      expect(songClipboard().buildSelectionClipboardPayload()).toBeNull();
    });
  });
});

describe('TASK-7.4 — SongStore paste validation (applySelectionClipboardPayload)', () => {
  beforeEach(() => {
    useSongStore.getState().loadSong(makeDefaultSong());
    useUIStore.getState().setSelection(null);
  });

  describe('error handling', () => {
    it('leaves the song unchanged when payload version is not 1 (unknown version, PAT-028)', () => {
      const before = structuredClone(useSongStore.getState().song);
      const payload = {
        version: 2,
        kind: 'selection',
        source: 'vybpad',
        copiedAt: new Date().toISOString(),
        selection: { type: 'chord' as const, measureIndex: 0, eventIds: [] },
        measures: [],
      };
      songClipboard().applySelectionClipboardPayload(payload as unknown as SelectionClipboardPayload);
      expect(useSongStore.getState().song).toEqual(before);
    });

    it('leaves the song unchanged when source is not vybpad', () => {
      const before = structuredClone(useSongStore.getState().song);
      const payload = {
        version: 1,
        kind: 'selection',
        source: 'other-app',
        copiedAt: new Date().toISOString(),
        selection: { type: 'chord' as const, measureIndex: 0, eventIds: [] },
        measures: [],
      };
      songClipboard().applySelectionClipboardPayload(payload as unknown as SelectionClipboardPayload);
      expect(useSongStore.getState().song).toEqual(before);
    });

    it('leaves the song unchanged when kind is not selection', () => {
      const before = structuredClone(useSongStore.getState().song);
      const payload = {
        version: 1,
        kind: 'wholeSong',
        source: 'vybpad',
        copiedAt: new Date().toISOString(),
        selection: { type: 'chord' as const, measureIndex: 0, eventIds: [] },
        measures: [],
      };
      songClipboard().applySelectionClipboardPayload(payload as unknown as SelectionClipboardPayload);
      expect(useSongStore.getState().song).toEqual(before);
    });

    it('does not throw when rejecting an invalid payload', () => {
      const payload = {
        version: 99,
        kind: 'selection',
        source: 'vybpad',
        copiedAt: new Date().toISOString(),
        selection: { type: 'chord' as const, measureIndex: 0, eventIds: [] },
        measures: [],
      };
      expect(() =>
        songClipboard().applySelectionClipboardPayload(payload as unknown as SelectionClipboardPayload),
      ).not.toThrow();
    });
  });
});

describe('TASK-7.4 — SongStore paste merge at destination', () => {
  beforeEach(() => {
    useSongStore.getState().loadSong(makeDefaultSong());
    useUIStore.getState().setSelection(null);
  });

  describe('happy path', () => {
    it('merges pasted chords at the destination measure given by the current UI selection', () => {
      useSongStore.getState().editChord(0, {
        type: 'add',
        chord: { ...baseChord(), scaleDegree: 2 },
      });
      const chordId = useSongStore.getState().song.measures[0].chords[0].id;
      useUIStore.getState().setSelection({
        type: 'chord',
        measureIndex: 0,
        eventIds: [chordId],
      });

      const payload = songClipboard().buildSelectionClipboardPayload();
      expect(payload).not.toBeNull();

      // Destination: measure 5 (still 8 measures in default song).
      useSongStore.getState().editChord(5, {
        type: 'add',
        chord: { ...baseChord(), scaleDegree: 6, beat: 96 },
      });
      const destChordId = useSongStore.getState().song.measures[5].chords[0].id;
      useUIStore.getState().setSelection({
        type: 'chord',
        measureIndex: 5,
        eventIds: [destChordId],
      });

      songClipboard().applySelectionClipboardPayload(payload!);

      const m5 = useSongStore.getState().song.measures[5];
      expect(m5.chords.some((c) => c.scaleDegree === 2 && c.beat === 0)).toBe(true);
      expect(m5.chords.some((c) => c.id === destChordId)).toBe(true);
    });
  });
});

describe('TASK-7.4 — SongStore undo/redo for clipboard paste', () => {
  beforeEach(() => {
    useSongStore.getState().loadSong(makeDefaultSong());
    useUIStore.getState().setSelection(null);
  });

  describe('happy path', () => {
    it('restores the prior song with undo after applySelectionClipboardPayload, and redo reapplies the paste', () => {
      useSongStore.getState().editChord(0, {
        type: 'add',
        chord: baseChord(),
      });
      const chordId = useSongStore.getState().song.measures[0].chords[0].id;
      useUIStore.getState().setSelection({
        type: 'chord',
        measureIndex: 0,
        eventIds: [chordId],
      });
      const payload = songClipboard().buildSelectionClipboardPayload();
      expect(payload).not.toBeNull();

      const beforePaste = structuredClone(useSongStore.getState().song);
      useUIStore.getState().setSelection({
        type: 'chord',
        measureIndex: 3,
        eventIds: [],
      });

      songClipboard().applySelectionClipboardPayload(payload!);
      const afterPaste = structuredClone(useSongStore.getState().song);
      expect(afterPaste).not.toEqual(beforePaste);

      useSongStore.getState().undo();
      expect(useSongStore.getState().song).toEqual(beforePaste);

      useSongStore.getState().redo();
      expect(useSongStore.getState().song).toEqual(afterPaste);
    });
  });
});
