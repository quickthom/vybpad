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
 *
 * QA COVERAGE PLAN — TASK-2.15
 *
 * Chord mutations (all action types + ordering / isolation)
 * Note mutations (add/delete/move/resize/update × voices 0–3)
 * Measure mutations (insert count empty; delete range; last measure; invalid range)
 * Undo/redo (chord flow; flags; redo cleared on new edit; multi-undo chain)
 * Metadata / band partial merge
 * Edge: delete last chord; delete last measure; noop deleteMeasures
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

    it('moves a chord to the destination measure when the source no longer matches the callback measure', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChordPayload() });
      const id = useSongStore.getState().song.measures[0].chords[0].id;
      useSongStore.getState().editChord(1, { type: 'move', chordId: id, newBeat: 12 });
      expect(useSongStore.getState().song.measures[0].chords).toEqual([]);
      expect(useSongStore.getState().song.measures[1].chords).toHaveLength(1);
      expect(useSongStore.getState().song.measures[1].chords[0]).toMatchObject({ id, beat: 12 });
    });

    it('re-locates a chord on cross-measure resize update payload', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: { ...baseChordPayload(), beat: 160, duration: 24 } });
      const id = useSongStore.getState().song.measures[0].chords[0].id;
      useSongStore.getState().editChord(1, {
        type: 'update',
        chordId: id,
        changes: { beat: 12, duration: 24 },
      });
      expect(useSongStore.getState().song.measures[0].chords).toEqual([]);
      expect(useSongStore.getState().song.measures[1].chords).toHaveLength(1);
      expect(useSongStore.getState().song.measures[1].chords[0]).toMatchObject({ id, beat: 12, duration: 24 });
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

    it('moves a note to the destination measure when the source no longer matches the callback measure', () => {
      useSongStore.getState().editNote(0, 0, { type: 'add', note: baseNotePayload() });
      const id = useSongStore.getState().song.measures[0].notes[0][0].id;
      useSongStore.getState().editNote(1, 0, { type: 'move', noteId: id, newBeat: 12 });
      expect(useSongStore.getState().song.measures[0].notes[0]).toEqual([]);
      expect(useSongStore.getState().song.measures[1].notes[0]).toHaveLength(1);
      expect(useSongStore.getState().song.measures[1].notes[0][0]).toMatchObject({ id, beat: 12 });
    });

    it('re-locates a note on cross-measure resize update payload', () => {
      useSongStore.getState().editNote(0, 0, { type: 'add', note: { ...baseNotePayload(), beat: 160, duration: 24 } });
      const id = useSongStore.getState().song.measures[0].notes[0][0].id;
      useSongStore.getState().editNote(1, 0, {
        type: 'update',
        noteId: id,
        changes: { beat: 12, duration: 24 },
      });
      expect(useSongStore.getState().song.measures[0].notes[0]).toEqual([]);
      expect(useSongStore.getState().song.measures[1].notes[0]).toHaveLength(1);
      expect(useSongStore.getState().song.measures[1].notes[0][0]).toMatchObject({ id, beat: 12, duration: 24 });
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

describe('TASK-2.15 — comprehensive SongStore mutations and undo/redo', () => {
  beforeEach(() => {
    useSongStore.getState().loadSong(makeDefaultSong());
  });

  describe('chord mutations — ordering, isolation, and id stability', () => {
    it('sorts multiple added chords by beat ascending in song.measures[n].chords', () => {
      useSongStore.getState().editChord(0, {
        type: 'add',
        chord: { ...baseChordPayload(), beat: 96, duration: 24 },
      });
      useSongStore.getState().editChord(0, {
        type: 'add',
        chord: { ...baseChordPayload(), beat: 0, duration: 48 },
      });
      const beats = useSongStore.getState().song.measures[0].chords.map((c) => c.beat);
      expect(beats).toEqual([0, 96]);
    });

    it('leaves other measures unchanged when editing chords in one measure', () => {
      const m1Before = structuredClone(useSongStore.getState().song.measures[1]);
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChordPayload() });
      expect(useSongStore.getState().song.measures[1]).toEqual(m1Before);
    });

    it('preserves chord id on update while merging fields onto song.measures[n].chords', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChordPayload() });
      const id = useSongStore.getState().song.measures[0].chords[0].id;
      useSongStore.getState().editChord(0, {
        type: 'update',
        chordId: id,
        changes: { scaleDegree: 4, quality: 'diminished' },
      });
      const c = useSongStore.getState().song.measures[0].chords[0];
      expect(c.id).toBe(id);
      expect(c.scaleDegree).toBe(4);
      expect(c.quality).toBe('diminished');
    });
  });

  describe('note mutations — all actions for each voice 0–3', () => {
    it.each([0, 1, 2, 3] as const)(
      'add: inserts into song.measures[0].notes[%i] only',
      (voice) => {
        useSongStore.getState().editNote(0, voice, { type: 'add', note: baseNotePayload() });
        for (let v = 0; v < 4; v++) {
          const len = v === voice ? 1 : 0;
          expect(useSongStore.getState().song.measures[0].notes[v]).toHaveLength(len);
        }
      },
    );

    it.each([0, 1, 2, 3] as const)(
      'delete: removes from song.measures[0].notes[%i] by noteId',
      (voice) => {
        useSongStore.getState().editNote(0, voice, { type: 'add', note: baseNotePayload() });
        const id = useSongStore.getState().song.measures[0].notes[voice][0].id;
        useSongStore.getState().editNote(0, voice, { type: 'delete', noteId: id });
        expect(useSongStore.getState().song.measures[0].notes[voice]).toEqual([]);
      },
    );

    it.each([0, 1, 2, 3] as const)(
      'move: updates beat (and optional degree/octave) in song.measures[0].notes[%i]',
      (voice) => {
        useSongStore.getState().editNote(0, voice, { type: 'add', note: baseNotePayload() });
        const id = useSongStore.getState().song.measures[0].notes[voice][0].id;
        useSongStore.getState().editNote(0, voice, {
          type: 'move',
          noteId: id,
          newBeat: 36,
          newScaleDegree: 5,
          newOctave: -1,
        });
        const n = useSongStore.getState().song.measures[0].notes[voice][0];
        expect(n.beat).toBe(36);
        expect(n.scaleDegree).toBe(5);
        expect(n.octave).toBe(-1);
      },
    );

    it.each([0, 1, 2, 3] as const)(
      'resize: updates duration in song.measures[0].notes[%i]',
      (voice) => {
        useSongStore.getState().editNote(0, voice, { type: 'add', note: baseNotePayload() });
        const id = useSongStore.getState().song.measures[0].notes[voice][0].id;
        useSongStore.getState().editNote(0, voice, {
          type: 'resize',
          noteId: id,
          newDuration: 72,
        });
        expect(useSongStore.getState().song.measures[0].notes[voice][0].duration).toBe(72);
      },
    );

    it.each([0, 1, 2, 3] as const)(
      'update: merges Partial<NoteEvent> onto song.measures[0].notes[%i] while preserving id',
      (voice) => {
        useSongStore.getState().editNote(0, voice, { type: 'add', note: baseNotePayload() });
        const id = useSongStore.getState().song.measures[0].notes[voice][0].id;
        useSongStore.getState().editNote(0, voice, {
          type: 'update',
          noteId: id,
          changes: { chromatic: -1, velocity: 80 },
        });
        const n = useSongStore.getState().song.measures[0].notes[voice][0];
        expect(n.id).toBe(id);
        expect(n.chromatic).toBe(-1);
        expect(n.velocity).toBe(80);
      },
    );
  });

  describe('measure mutations — addMeasures and deleteMeasures', () => {
    it('addMeasures(index, count) inserts count empty measures with chords [] and four empty note lanes', () => {
      const beforeLen = useSongStore.getState().song.measures.length;
      useSongStore.getState().addMeasures(3, 4);
      expect(useSongStore.getState().song.measures).toHaveLength(beforeLen + 4);
      for (let i = 3; i < 3 + 4; i++) {
        const m = useSongStore.getState().song.measures[i];
        expect(m.chords).toEqual([]);
        expect(m.notes).toEqual([[], [], [], []]);
        expect(m.id).toMatch(UUID_V4);
      }
    });

    it('addMeasures clamps atIndex past the end so new measures append', () => {
      const len = useSongStore.getState().song.measures.length;
      useSongStore.getState().addMeasures(len + 10, 1);
      expect(useSongStore.getState().song.measures).toHaveLength(len + 1);
      expect(useSongStore.getState().song.measures[len].chords).toEqual([]);
    });

    it('deleteMeasures(start, end) removes the inclusive range and shortens measures', () => {
      const len = useSongStore.getState().song.measures.length;
      useSongStore.getState().deleteMeasures(2, 5);
      expect(useSongStore.getState().song.measures).toHaveLength(len - 4);
    });

    it('deleteMeasures at the last measure only removes that measure', () => {
      const len = useSongStore.getState().song.measures.length;
      useSongStore.getState().deleteMeasures(len - 1, len - 1);
      expect(useSongStore.getState().song.measures).toHaveLength(len - 1);
    });

    it('deleteMeasures when start is past the last index is a no-op (no dirty flag / no undo)', () => {
      const len = useSongStore.getState().song.measures.length;
      const snap = structuredClone(useSongStore.getState().song);
      useSongStore.getState().deleteMeasures(len, len);
      expect(useSongStore.getState().song).toEqual(snap);
      expect(useSongStore.getState().isDirty).toBe(false);
      expect(useSongStore.getState().canUndo).toBe(false);
    });
  });

  describe('undo/redo — chord edits and history flags', () => {
    it('after chord add then undo: chord is gone and canUndo is false', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChordPayload() });
      expect(useSongStore.getState().song.measures[0].chords).toHaveLength(1);
      useSongStore.getState().undo();
      expect(useSongStore.getState().song.measures[0].chords).toEqual([]);
      expect(useSongStore.getState().canUndo).toBe(false);
    });

    it('redo restores the chord after an undone chord add', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChordPayload() });
      const beforeUndo = structuredClone(useSongStore.getState().song.measures[0].chords[0]);
      useSongStore.getState().undo();
      expect(useSongStore.getState().song.measures[0].chords).toHaveLength(0);
      useSongStore.getState().redo();
      const chords = useSongStore.getState().song.measures[0].chords;
      expect(chords).toHaveLength(1);
      expect(chords[0].id).toBe(beforeUndo.id);
      expect(chords[0].beat).toBe(beforeUndo.beat);
    });

    it('a new mutation after undo clears the redo stack (canRedo false)', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChordPayload() });
      useSongStore.getState().undo();
      expect(useSongStore.getState().canRedo).toBe(true);
      useSongStore.getState().editChord(0, {
        type: 'add',
        chord: { ...baseChordPayload(), beat: 24, duration: 24 },
      });
      expect(useSongStore.getState().canRedo).toBe(false);
    });

    it('canUndo and canRedo reflect actual past/future stacks after two edits and one undo', () => {
      useSongStore.getState().updateMetadata({ title: 'One' });
      useSongStore.getState().updateMetadata({ title: 'Two' });
      expect(useSongStore.getState().canUndo).toBe(true);
      expect(useSongStore.getState().canRedo).toBe(false);
      useSongStore.getState().undo();
      expect(useSongStore.getState().song.metadata.title).toBe('One');
      expect(useSongStore.getState().canUndo).toBe(true);
      expect(useSongStore.getState().canRedo).toBe(true);
      useSongStore.getState().undo();
      expect(useSongStore.getState().song.metadata.title).toBe('Untitled');
      expect(useSongStore.getState().canUndo).toBe(false);
      expect(useSongStore.getState().canRedo).toBe(true);
    });
  });

  describe('metadata and bandConfig — partial merge', () => {
    it('updateMetadata merges partial SongMetadata without clearing unspecified fields', () => {
      useSongStore.getState().updateMetadata({ title: 'New title' });
      const m = useSongStore.getState().song.metadata;
      expect(m.title).toBe('New title');
      expect(m.tempo).toBe(120);
      expect(m.key).toBe('C');
      useSongStore.getState().updateMetadata({ tempo: 99 });
      expect(useSongStore.getState().song.metadata.title).toBe('New title');
      expect(useSongStore.getState().song.metadata.tempo).toBe(99);
    });

    it('updateBandConfig merges by track role without resetting unrelated tracks', () => {
      const bassBefore = useSongStore.getState().song.bandConfig.tracks.find((t) => t.role === 'bass');
      useSongStore.getState().updateBandConfig({
        tracks: [{ role: 'melody1', volume: 0.11, mute: true }],
      });
      const m1 = useSongStore.getState().song.bandConfig.tracks.find((t) => t.role === 'melody1');
      const bass = useSongStore.getState().song.bandConfig.tracks.find((t) => t.role === 'bass');
      expect(m1?.volume).toBe(0.11);
      expect(m1?.mute).toBe(true);
      expect(bass).toEqual(bassBefore);
    });
  });

  describe('loadSong — undo baseline', () => {
    it('after loadSong, canUndo is false even if the loaded song was edited in a prior session clone', () => {
      const incoming = makeDefaultSong();
      incoming.metadata.title = 'File';
      useSongStore.getState().loadSong(incoming);
      expect(useSongStore.getState().canUndo).toBe(false);
      expect(useSongStore.getState().song.metadata.title).toBe('File');
    });
  });

  describe('edge cases', () => {
    it('delete last chord in a measure leaves song.measures[n].chords as an empty array', () => {
      useSongStore.getState().editChord(0, { type: 'add', chord: baseChordPayload() });
      const id = useSongStore.getState().song.measures[0].chords[0].id;
      useSongStore.getState().editChord(0, { type: 'delete', chordId: id });
      expect(useSongStore.getState().song.measures[0].chords).toEqual([]);
    });

    it('chained multiple undos restore each prior song state in order (metadata chain)', () => {
      useSongStore.getState().updateMetadata({ title: 'A' });
      useSongStore.getState().updateMetadata({ title: 'B' });
      useSongStore.getState().updateMetadata({ title: 'C' });
      useSongStore.getState().undo();
      expect(useSongStore.getState().song.metadata.title).toBe('B');
      useSongStore.getState().undo();
      expect(useSongStore.getState().song.metadata.title).toBe('A');
      useSongStore.getState().undo();
      expect(useSongStore.getState().song.metadata.title).toBe('Untitled');
      expect(useSongStore.getState().canUndo).toBe(false);
    });
  });

  describe('TASK-7.3 — editNoteBatch (single undo step)', () => {
    it('applies two note actions with one undo snapshot', () => {
      useSongStore.getState().loadSong(makeDefaultSong());
      useSongStore.getState().editNote(0, 0, {
        type: 'add',
        note: {
          scaleDegree: 1,
          octave: 0,
          chromatic: 0,
          beat: 0,
          duration: 48,
          isRest: false,
          velocity: 100,
        },
      });
      const id = useSongStore.getState().song.measures[0].notes[0][0]!.id;
      useSongStore.getState().editNoteBatch([
        { measureIndex: 0, voice: 0, action: { type: 'resize', noteId: id, newDuration: 24 } },
        {
          measureIndex: 0,
          voice: 0,
          action: {
            type: 'add',
            note: {
              scaleDegree: 1,
              octave: 0,
              chromatic: 0,
              beat: 24,
              duration: 24,
              isRest: false,
              velocity: 100,
            },
          },
        },
      ]);
      expect(useSongStore.getState().song.measures[0].notes[0]).toHaveLength(2);
      useSongStore.getState().undo();
      expect(useSongStore.getState().song.measures[0].notes[0]).toHaveLength(1);
      expect(useSongStore.getState().song.measures[0].notes[0][0]!.duration).toBe(48);
    });
  });
});
