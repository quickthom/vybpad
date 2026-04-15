/**
 * TASK-7.3 — Undo must restore the full prior song after one split / tie / triplet user command.
 *
 * Contract: INTERFACES.md SongStore — each user-facing command produces a single undo step (PAT-009 with TASK-7.3).
 * Today, two sequential `editNote` calls create two undo points; TASK-7.3 implementations must batch or use one mutation
 * so one `undo()` restores the exact pre-command snapshot.
 */
import type { NoteEvent, SongData } from '@vybpad/shared';
import { randomUUID } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { useSongStore } from '../../../src/store/songStore';

function makeOneNoteSong(note: Omit<NoteEvent, 'id'> & { id?: string }): SongData {
  const id = note.id ?? randomUUID();
  const full: NoteEvent = { ...note, id };
  return {
    version: '1.0',
    metadata: {
      title: 'T',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
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
    measures: [
      {
        id: randomUUID(),
        chords: [],
        notes: [[full], [], [], []],
      },
    ],
  };
}

describe('TASK-7.3 — SongStore undo parity for split (single user command)', () => {
  beforeEach(() => {
    useSongStore.getState().loadSong(
      makeOneNoteSong({
        scaleDegree: 1,
        octave: 0,
        chromatic: 0,
        beat: 0,
        duration: 48,
        isRest: false,
        velocity: 100,
      }),
    );
  });

  it('one undo restores the full song after a split implemented as a single store mutation (not two separate editNote calls)', () => {
    const before = structuredClone(useSongStore.getState().song);
    const noteId = before.measures[0].notes[0][0].id;

    // One `/` press must map to a single `editNoteBatch` (not two `editNote` calls — two undo points).
    useSongStore.getState().editNoteBatch([
      { measureIndex: 0, voice: 0, action: { type: 'resize', noteId, newDuration: 24 } },
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

    useSongStore.getState().undo();

    expect(useSongStore.getState().song).toEqual(before);
  });
});
