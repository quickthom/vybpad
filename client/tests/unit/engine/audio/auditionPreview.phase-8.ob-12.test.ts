/**
 * OB-1 / OB-2 — editor click audition MIDI resolution (melody pitch + harmony voicing + bass).
 */

import { randomUUID } from 'node:crypto';

import type { ChordEvent, NoteEvent, SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import { getEditorHitAuditionMidis } from '../../../../src/engine/audio/auditionPreview';
import { theoryEngine } from '../../../../src/engine/theory/theoryEngine';

function makeSong(chord: ChordEvent, note: NoteEvent): SongData {
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
        chords: [chord],
        notes: [[note], [], [], []],
      },
      ...Array.from({ length: 7 }, () => ({
        id: randomUUID(),
        chords: [],
        notes: [[], [], [], []] as [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]],
      })),
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

describe('auditionPreview — OB-1 / OB-2 — getEditorHitAuditionMidis', () => {
  it('returns null for a rest note hit', () => {
    const chordId = randomUUID();
    const noteId = randomUUID();
    const chord: ChordEvent = {
      id: chordId,
      scaleDegree: 1,
      quality: 'major',
      seventh: 'none',
      suspension: 'none',
      addition: 'none',
      inversion: 0,
      borrowed: null,
      secondary: null,
      beat: 0,
      duration: 96,
    };
    const note: NoteEvent = {
      id: noteId,
      scaleDegree: 1,
      octave: 0,
      chromatic: 0,
      beat: 48,
      duration: 24,
      isRest: true,
      velocity: 100,
    };
    const song = makeSong(chord, note);
    expect(
      getEditorHitAuditionMidis(song, { kind: 'note', measureIndex: 0, voiceIndex: 0, note }),
    ).toBeNull();
  });

  it('OB-1: matches scaleDegreeToMidi for a melody note (melody1 track octave)', () => {
    const chordId = randomUUID();
    const noteId = randomUUID();
    const chord: ChordEvent = {
      id: chordId,
      scaleDegree: 1,
      quality: 'major',
      seventh: 'none',
      suspension: 'none',
      addition: 'none',
      inversion: 0,
      borrowed: null,
      secondary: null,
      beat: 0,
      duration: 96,
    };
    const note: NoteEvent = {
      id: noteId,
      scaleDegree: 3,
      octave: 0,
      chromatic: 0,
      beat: 48,
      duration: 24,
      isRest: false,
      velocity: 100,
    };
    const song = makeSong(chord, note);
    const midis = getEditorHitAuditionMidis(song, { kind: 'note', measureIndex: 0, voiceIndex: 0, note });
    expect(midis).toHaveLength(1);
    expect(midis![0]).toBe(theoryEngine.scaleDegreeToMidi(3, 0, 0, 'C', 'major', 4));
  });

  it('OB-2: returns harmony + bass MIDI for a chord hit (voice-leading chain)', () => {
    const c0 = randomUUID();
    const c1 = randomUUID();
    const chordA: ChordEvent = {
      id: c0,
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
    const chordB: ChordEvent = {
      id: c1,
      scaleDegree: 5,
      quality: 'major',
      seventh: 'dom7',
      suspension: 'none',
      addition: 'none',
      inversion: 0,
      borrowed: null,
      secondary: null,
      beat: 48,
      duration: 48,
    };
    const note: NoteEvent = {
      id: randomUUID(),
      scaleDegree: 1,
      octave: 0,
      chromatic: 0,
      beat: 96,
      duration: 24,
      isRest: false,
      velocity: 100,
    };
    const song: SongData = {
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
          chords: [chordA, chordB],
          notes: [[note], [], [], []],
        },
        ...Array.from({ length: 7 }, () => ({
          id: randomUUID(),
          chords: [],
          notes: [[], [], [], []] as [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]],
        })),
      ],
      bandConfig: makeSong(chordA, note).bandConfig,
    };

    const midis = getEditorHitAuditionMidis(song, { kind: 'chord', measureIndex: 0, chord: chordB });
    expect(midis).not.toBeNull();
    expect(midis!.length).toBeGreaterThanOrEqual(4);
    const sorted = [...midis!].sort((a, b) => a - b);
    expect(sorted[0]).toBeLessThan(sorted[sorted.length - 1]!);
  });
});
