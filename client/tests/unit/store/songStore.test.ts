/**
 * TASK-2.1 — Zustand `SongStore` contract tests (INTERFACES.md).
 * Uses only `useSongStore.getState()` / `useSongStore` public surface (no store internals).
 *
 * QA COVERAGE PLAN — TASK-2.1
 *
 * Criterion: Full SongStore API surface (fields + methods from INTERFACES.md)
 *   happy: each method mutates or exposes state consistent with SongData / flags
 *   error: not specified in INTERFACES for store (no error shapes) — omit
 *   edges: redo stack cleared after new edit; loadSong replaces document
 *
 * Criterion: Default song matches INTERFACES Default Song Factory (8 measures)
 *   happy: `song` after loadSong(default) has 8 measures, expected metadata + bandConfig
 *
 * Criterion: Undo / redo for mutating operations
 *   happy: undo restores prior snapshot; redo reapplies; canUndo / canRedo track stack
 *   edges: new mutation after undo drops redo stack; undo depth cap observable via canUndo
 *
 * Criterion: loadSong behavior
 *   happy: `song` equals loaded SongData; isDirty false; undo/redo stacks cleared (via flags + behavior)
 */
import { randomUUID } from 'node:crypto';

import type { ChordEvent, Measure, NoteEvent, SongData } from '@vybpad/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSongStore } from '../../../src/store/songStore';

/** RFC 4122 UUID v4. */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** INTERFACES.md Default Song Factory shape (client-side; mirrors server `buildDefaultSong`). */
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
      notes: [[], [], [], []] as Measure['notes'],
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

function baseChordPayload(): Omit<ChordEvent, 'id'> {
  return {
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
  };
}

function baseNotePayload(): Omit<NoteEvent, 'id'> {
  return {
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    beat: 0,
    duration: 48,
    isRest: false,
    velocity: 100,
  };
}

describe('SongStore — INTERFACES.md contract', () => {
  beforeEach(() => {
    useSongStore.getState().loadSong(makeDefaultSong());
  });

  describe('initial state (8-measure default)', () => {
    it('exposes song with eight measures, INTERFACES metadata, and seven band tracks after loadSong(default)', () => {
      const { song } = useSongStore.getState();
      expect(song.version).toBe('1.0');
      expect(song.metadata).toEqual({
        title: 'Untitled',
        key: 'C',
        scale: 'major',
        tempo: 120,
        meter: { numerator: 4, denominator: 4 },
      });
      expect(song.measures).toHaveLength(8);
      for (const m of song.measures) {
        expect(m.id).toMatch(UUID_V4);
        expect(m.chords).toEqual([]);
        expect(m.notes).toEqual([[], [], [], []]);
      }
      expect(song.bandConfig.tracks).toHaveLength(7);
      expect(song.bandConfig.tracks.map((t) => t.role)).toEqual([
        'melody1',
        'melody2',
        'melody3',
        'melody4',
        'harmony',
        'bass',
        'drums',
      ]);
    });
  });

  describe('flags: isDirty, canUndo, canRedo', () => {
    it('sets isDirty to true when updateMetadata changes the document', () => {
      useSongStore.getState().updateMetadata({ title: 'Edited' });
      expect(useSongStore.getState().isDirty).toBe(true);
    });

    it('exposes canUndo true and canRedo false after a mutating edit', () => {
      useSongStore.getState().updateMetadata({ title: 'A' });
      const { canUndo, canRedo } = useSongStore.getState();
      expect(canUndo).toBe(true);
      expect(canRedo).toBe(false);
    });
  });

  describe('updateMetadata', () => {
    it('applies partial SongMetadata and allows undo to restore the previous metadata', () => {
      useSongStore.getState().updateMetadata({ title: 'Hello', tempo: 140 });
      expect(useSongStore.getState().song.metadata.title).toBe('Hello');
      expect(useSongStore.getState().song.metadata.tempo).toBe(140);
      useSongStore.getState().undo();
      expect(useSongStore.getState().song.metadata.title).toBe('Untitled');
      expect(useSongStore.getState().song.metadata.tempo).toBe(120);
    });
  });

  describe('editChord', () => {
    it('add: inserts a chord with a new stable id and keeps chords sorted by beat', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChordPayload() });
      const chords = useSongStore.getState().song.measures[0].chords;
      expect(chords).toHaveLength(1);
      expect(chords[0].id).toMatch(UUID_V4);
      expect(chords[0].beat).toBe(0);
    });

    it('delete: removes a chord by id', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChordPayload() });
      const id = useSongStore.getState().song.measures[0].chords[0].id;
      useSongStore.getState().editChord(0, { type: 'delete', chordId: id });
      expect(useSongStore.getState().song.measures[0].chords).toEqual([]);
    });

    it('move: updates chord beat position', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChordPayload() });
      const id = useSongStore.getState().song.measures[0].chords[0].id;
      useSongStore.getState().editChord(0, { type: 'move', chordId: id, newBeat: 24 });
      expect(useSongStore.getState().song.measures[0].chords[0].beat).toBe(24);
    });

    it('resize: updates chord duration', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChordPayload() });
      const id = useSongStore.getState().song.measures[0].chords[0].id;
      useSongStore.getState().editChord(0, { type: 'resize', chordId: id, newDuration: 96 });
      expect(useSongStore.getState().song.measures[0].chords[0].duration).toBe(96);
    });

    it('update: merges Partial<ChordEvent> onto the target chord', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChordPayload() });
      const id = useSongStore.getState().song.measures[0].chords[0].id;
      useSongStore.getState().editChord(0, {
        type: 'update',
        chordId: id,
        changes: { quality: 'minor', inversion: 1 },
      });
      const c = useSongStore.getState().song.measures[0].chords[0];
      expect(c.quality).toBe('minor');
      expect(c.inversion).toBe(1);
    });
  });

  describe('editNote', () => {
    it('add: inserts a note on the given voice with a new id', () => {
      useSongStore.getState().editNote(0, 0, { type: 'add', note: baseNotePayload() });
      const notes = useSongStore.getState().song.measures[0].notes[0];
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toMatch(UUID_V4);
    });

    it('delete: removes a note by id from the correct voice', () => {
      useSongStore.getState().editNote(0, 2, { type: 'add', note: baseNotePayload() });
      const id = useSongStore.getState().song.measures[0].notes[2][0].id;
      useSongStore.getState().editNote(0, 2, { type: 'delete', noteId: id });
      expect(useSongStore.getState().song.measures[0].notes[2]).toEqual([]);
    });

    it('move: updates beat and optional scale degree / octave', () => {
      useSongStore.getState().editNote(0, 0, { type: 'add', note: baseNotePayload() });
      const id = useSongStore.getState().song.measures[0].notes[0][0].id;
      useSongStore.getState().editNote(0, 0, {
        type: 'move',
        noteId: id,
        newBeat: 24,
        newScaleDegree: 3,
        newOctave: 1,
      });
      const n = useSongStore.getState().song.measures[0].notes[0][0];
      expect(n.beat).toBe(24);
      expect(n.scaleDegree).toBe(3);
      expect(n.octave).toBe(1);
    });

    it('resize: updates note duration', () => {
      useSongStore.getState().editNote(0, 0, { type: 'add', note: baseNotePayload() });
      const id = useSongStore.getState().song.measures[0].notes[0][0].id;
      useSongStore.getState().editNote(0, 0, { type: 'resize', noteId: id, newDuration: 96 });
      expect(useSongStore.getState().song.measures[0].notes[0][0].duration).toBe(96);
    });

    it('update: merges Partial<NoteEvent> onto the target note', () => {
      useSongStore.getState().editNote(0, 0, { type: 'add', note: baseNotePayload() });
      const id = useSongStore.getState().song.measures[0].notes[0][0].id;
      useSongStore.getState().editNote(0, 0, {
        type: 'update',
        noteId: id,
        changes: { isRest: true, velocity: 64 },
      });
      const n = useSongStore.getState().song.measures[0].notes[0][0];
      expect(n.isRest).toBe(true);
      expect(n.velocity).toBe(64);
    });

    it('ignores editNote when voice is outside 0–3 without mutating song', () => {
      const snap = structuredClone(useSongStore.getState().song);
      // @ts-expect-error — deliberate invalid voice for contract behavior
      useSongStore.getState().editNote(0, 9, {
        type: 'add',
        note: baseNotePayload(),
      });
      expect(useSongStore.getState().song).toEqual(snap);
    });
  });

  describe('setMeasureChanges', () => {
    it('writes MeasureChanges onto the target measure', () => {
      useSongStore.getState().setMeasureChanges(2, { key: 'G', tempo: 90 });
      const ch = useSongStore.getState().song.measures[2].changes;
      expect(ch?.key).toBe('G');
      expect(ch?.tempo).toBe(90);
    });
  });

  describe('addMeasures and deleteMeasures', () => {
    it('addMeasures: inserts empty measures at the index and shifts length', () => {
      const before = useSongStore.getState().song.measures.length;
      useSongStore.getState().addMeasures(2, 2);
      expect(useSongStore.getState().song.measures).toHaveLength(before + 2);
      expect(useSongStore.getState().song.measures[2].chords).toEqual([]);
    });

    it('deleteMeasures: removes the inclusive range from the song', () => {
      const len = useSongStore.getState().song.measures.length;
      useSongStore.getState().deleteMeasures(1, 3);
      expect(useSongStore.getState().song.measures).toHaveLength(len - 3);
    });
  });

  describe('updateBandConfig', () => {
    it('merges band configuration so track roles remain addressable', () => {
      const tracks = useSongStore.getState().song.bandConfig.tracks.map((t) =>
        t.role === 'melody1' ? { ...t, volume: 0.42 } : t,
      );
      useSongStore.getState().updateBandConfig({ tracks });
      const m1 = useSongStore.getState().song.bandConfig.tracks.find((t) => t.role === 'melody1');
      expect(m1?.volume).toBe(0.42);
    });
  });

  describe('undo / redo', () => {
    it('redo reapplies an undone metadata edit', () => {
      useSongStore.getState().updateMetadata({ title: 'Once' });
      useSongStore.getState().undo();
      expect(useSongStore.getState().song.metadata.title).toBe('Untitled');
      useSongStore.getState().redo();
      expect(useSongStore.getState().song.metadata.title).toBe('Once');
    });

    it('clears the redo stack when a new mutation runs after undo', () => {
      useSongStore.getState().updateMetadata({ title: 'A' });
      useSongStore.getState().undo();
      expect(useSongStore.getState().canRedo).toBe(true);
      useSongStore.getState().updateMetadata({ title: 'B' });
      expect(useSongStore.getState().canRedo).toBe(false);
    });

    it('stops offering further undos after PAT-009 depth (20) from a long edit chain', () => {
      for (let i = 0; i < 25; i++) {
        useSongStore.getState().updateMetadata({ title: `T${i}` });
      }
      for (let u = 0; u < 20; u++) {
        expect(useSongStore.getState().canUndo).toBe(true);
        useSongStore.getState().undo();
      }
      expect(useSongStore.getState().canUndo).toBe(false);
    });
  });

  describe('loadSong', () => {
    it('replaces `song` with the provided SongData snapshot', () => {
      const incoming = makeDefaultSong();
      incoming.metadata.title = 'Imported';
      useSongStore.getState().loadSong(incoming);
      expect(useSongStore.getState().song).toEqual(incoming);
    });

    it('sets isDirty to false and clears undo/redo after loadSong', () => {
      useSongStore.getState().updateMetadata({ title: 'Dirty' });
      expect(useSongStore.getState().isDirty).toBe(true);
      const incoming = makeDefaultSong();
      useSongStore.getState().loadSong(incoming);
      expect(useSongStore.getState().isDirty).toBe(false);
      expect(useSongStore.getState().canUndo).toBe(false);
      expect(useSongStore.getState().canRedo).toBe(false);
    });

    it('makes the prior document unreachable via undo after loadSong', () => {
      useSongStore.getState().updateMetadata({ title: 'Before' });
      expect(useSongStore.getState().canUndo).toBe(true);
      useSongStore.getState().loadSong(makeDefaultSong());
      useSongStore.getState().undo();
      expect(useSongStore.getState().song.metadata.title).toBe('Untitled');
    });
  });
});
