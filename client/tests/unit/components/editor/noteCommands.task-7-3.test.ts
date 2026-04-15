/**
 * TASK-7.3 — split / tie / triplet planners (PAT-004).
 */
import { randomUUID } from 'node:crypto';

import type { NoteEvent, SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  planSplitNote,
  planTieNote,
  planTripletToggle,
  selectionAfterSplit,
} from '../../../../src/components/editor/noteCommands';

function minimalSong(): SongData {
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
        id: randomUUID(),
        chords: [],
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

function note(partial: Partial<NoteEvent> & Pick<NoteEvent, 'beat' | 'duration'>): NoteEvent {
  return {
    id: randomUUID(),
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    isRest: false,
    velocity: 100,
    ...partial,
  };
}

describe('TASK-7.3 noteCommands', () => {
  it('split: midpoint on 48-tick quarter → 24 + 24 and preserves pitch', () => {
    const a = note({ beat: 0, duration: 48 });
    const song = minimalSong();
    song.measures[0]!.notes[0] = [a];

    const ops = planSplitNote(song, { type: 'note', measureIndex: 0, eventIds: [a.id] });
    expect(ops).toHaveLength(2);
    expect(ops![0]).toEqual({ measureIndex: 0, voice: 0, action: { type: 'resize', noteId: a.id, newDuration: 24 } });
    expect(ops![1].action.type).toBe('add');
    if (ops![1].action.type === 'add') {
      expect(ops![1].action.note.beat).toBe(24);
      expect(ops![1].action.note.duration).toBe(24);
      expect(ops![1].action.note.scaleDegree).toBe(1);
    }
  });

  it('tie: merges forward when next touches and matches pitch', () => {
    const n0 = note({ beat: 0, duration: 24 });
    const n1 = note({ beat: 24, duration: 24, scaleDegree: 1 });
    const song = minimalSong();
    song.measures[0]!.notes[0] = [n0, n1];

    const ops = planTieNote(song, { type: 'note', measureIndex: 0, eventIds: [n0.id] });
    expect(ops).toEqual([
      { measureIndex: 0, voice: 0, action: { type: 'resize', noteId: n0.id, newDuration: 48 } },
      { measureIndex: 0, voice: 0, action: { type: 'delete', noteId: n1.id } },
    ]);
  });

  it('tie: two selected event ids merge when adjacent same pitch', () => {
    const n0 = note({ beat: 0, duration: 24 });
    const n1 = note({ beat: 24, duration: 24 });
    const song = minimalSong();
    song.measures[0]!.notes[0] = [n0, n1];

    const ops = planTieNote(song, { type: 'note', measureIndex: 0, eventIds: [n0.id, n1.id] });
    expect(ops?.[0].action).toEqual({ type: 'resize', noteId: n0.id, newDuration: 48 });
    expect(ops?.[1].action).toEqual({ type: 'delete', noteId: n1.id });
  });

  it('tie: merges backward when selected note follows matching prior', () => {
    const n0 = note({ beat: 0, duration: 24 });
    const n1 = note({ beat: 24, duration: 12 });
    const song = minimalSong();
    song.measures[0]!.notes[0] = [n0, n1];

    const ops = planTieNote(song, { type: 'note', measureIndex: 0, eventIds: [n1.id] });
    expect(ops?.[0].action).toEqual({ type: 'resize', noteId: n0.id, newDuration: 36 });
    expect(ops?.[1].action).toEqual({ type: 'delete', noteId: n1.id });
  });

  it('triplet: toggles 48 ↔ 32', () => {
    const n = note({ beat: 0, duration: 48 });
    const song = minimalSong();
    song.measures[0]!.notes[0] = [n];

    const toTr = planTripletToggle(song, { type: 'note', measureIndex: 0, eventIds: [n.id] });
    expect(toTr).toEqual([
      { measureIndex: 0, voice: 0, action: { type: 'resize', noteId: n.id, newDuration: 32 } },
    ]);

    const n32 = { ...n, duration: 32 };
    song.measures[0]!.notes[0] = [n32];
    const toSt = planTripletToggle(song, { type: 'note', measureIndex: 0, eventIds: [n32.id] });
    expect(toSt?.[0].action).toEqual({ type: 'resize', noteId: n32.id, newDuration: 48 });
  });

  it('selectionAfterSplit finds the new fragment at splitBeat', () => {
    const song = minimalSong();
    const first = note({ beat: 0, duration: 24 });
    const newSecond = note({ beat: 24, duration: 24 });
    song.measures[0]!.notes[0] = [first, newSecond];

    const sel = selectionAfterSplit(song, 0, 0, 24, 24);
    expect(sel).toEqual({ type: 'note', measureIndex: 0, eventIds: [newSecond.id] });
  });
});
