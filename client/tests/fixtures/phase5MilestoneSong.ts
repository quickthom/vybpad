import type { ChordEvent, NoteEvent, SongData } from '@vybpad/shared';

function measureId(index: number): string {
  return `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function chordId(index: number): string {
  return `31000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function noteId(index: number): string {
  return `32000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function chord(overrides: Partial<ChordEvent> & Pick<ChordEvent, 'id' | 'beat'>): ChordEvent {
  return {
    id: overrides.id,
    scaleDegree: 1,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat: overrides.beat,
    duration: 96,
    ...overrides,
  };
}

function note(overrides: Partial<NoteEvent> & Pick<NoteEvent, 'id' | 'beat'>): NoteEvent {
  return {
    id: overrides.id,
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    beat: overrides.beat,
    duration: 48,
    isRest: false,
    velocity: 100,
    ...overrides,
  };
}

export function buildPhase5MilestoneSong(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-5.9 milestone fixture',
      key: 'C',
      scale: 'major',
      tempo: 300,
      meter: { numerator: 4, denominator: 4 },
    },
    bandConfig: {
      tracks: [
        { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
        { role: 'melody2', instrument: 'piano', volume: 0.6, mute: false, octave: 0 },
        { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
        { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
        { role: 'drums', instrument: 'piano', volume: 0.0, mute: true, octave: 0 },
      ],
    },
    measures: [
      {
        id: measureId(1),
        chords: [
          chord({
            id: chordId(1),
            beat: 0,
            scaleDegree: 1,
            quality: 'major',
            seventh: 'maj7',
            addition: 'add9',
            duration: 96,
          }),
          chord({
            id: chordId(2),
            beat: 96,
            scaleDegree: 4,
            quality: 'minor',
            seventh: 'min7',
            inversion: 1,
            borrowed: 'minor',
            duration: 96,
          }),
        ],
        notes: [
          [note({ id: noteId(1), beat: 0, scaleDegree: 1 }), note({ id: noteId(2), beat: 96, scaleDegree: 3 })],
          [note({ id: noteId(3), beat: 48, scaleDegree: 5 }), note({ id: noteId(4), beat: 144, scaleDegree: 6 })],
          [],
          [],
        ],
      },
      {
        id: measureId(2),
        chords: [
          chord({
            id: chordId(3),
            beat: 0,
            scaleDegree: 5,
            quality: 'major',
            seventh: 'dom7',
            inversion: 2,
            secondary: { function: 'V', target: 2 },
            duration: 96,
          }),
          chord({
            id: chordId(4),
            beat: 96,
            scaleDegree: 2,
            quality: 'minor',
            seventh: 'min7',
            suspension: 'sus4',
            duration: 96,
          }),
        ],
        notes: [
          [note({ id: noteId(5), beat: 0, scaleDegree: 2 }), note({ id: noteId(6), beat: 96, scaleDegree: 5 })],
          [note({ id: noteId(7), beat: 48, scaleDegree: 4 }), note({ id: noteId(8), beat: 144, scaleDegree: 2 })],
          [],
          [],
        ],
      },
      {
        id: measureId(3),
        chords: [
          chord({ id: chordId(5), beat: 0, scaleDegree: 6, quality: 'minor', seventh: 'min7' }),
          chord({ id: chordId(6), beat: 96, scaleDegree: 5, quality: 'major', seventh: 'dom7' }),
        ],
        notes: [[note({ id: noteId(9), beat: 0, scaleDegree: 6 })], [note({ id: noteId(10), beat: 96, scaleDegree: 1 })], [], []],
      },
      {
        id: measureId(4),
        chords: [
          chord({ id: chordId(7), beat: 0, scaleDegree: 2, quality: 'minor', seventh: 'min7' }),
          chord({ id: chordId(8), beat: 96, scaleDegree: 5, quality: 'major', seventh: 'dom7' }),
        ],
        notes: [[note({ id: noteId(11), beat: 48, scaleDegree: 7 })], [note({ id: noteId(12), beat: 144, scaleDegree: 2 })], [], []],
      },
      {
        id: measureId(5),
        chords: [
          chord({
            id: chordId(9),
            beat: 0,
            scaleDegree: 1,
            quality: 'minor',
            seventh: 'min7',
            addition: 'add11',
            duration: 96,
          }),
          chord({
            id: chordId(10),
            beat: 96,
            scaleDegree: 4,
            quality: 'major',
            seventh: 'dom7',
            duration: 96,
          }),
        ],
        notes: [
          [note({ id: noteId(13), beat: 0, scaleDegree: 1 }), note({ id: noteId(14), beat: 96, scaleDegree: 3 })],
          [note({ id: noteId(15), beat: 48, scaleDegree: 5 }), note({ id: noteId(16), beat: 144, scaleDegree: 6 })],
          [],
          [],
        ],
        changes: { key: 'D', scale: 'minor' },
      },
      {
        id: measureId(6),
        chords: [
          chord({ id: chordId(11), beat: 0, scaleDegree: 6, quality: 'major', borrowed: 'major' }),
          chord({ id: chordId(12), beat: 96, scaleDegree: 5, quality: 'major', seventh: 'dom7' }),
        ],
        notes: [[note({ id: noteId(17), beat: 0, scaleDegree: 4 })], [note({ id: noteId(18), beat: 96, scaleDegree: 7 })], [], []],
      },
      {
        id: measureId(7),
        chords: [
          chord({ id: chordId(13), beat: 0, scaleDegree: 2, quality: 'diminished', seventh: 'min7b5' }),
          chord({ id: chordId(14), beat: 96, scaleDegree: 5, quality: 'major', seventh: 'dom7', inversion: 1 }),
        ],
        notes: [[note({ id: noteId(19), beat: 48, scaleDegree: 2 })], [note({ id: noteId(20), beat: 144, scaleDegree: 4 })], [], []],
      },
      {
        id: measureId(8),
        chords: [
          chord({ id: chordId(15), beat: 0, scaleDegree: 1, quality: 'minor', seventh: 'min7' }),
          chord({ id: chordId(16), beat: 96, scaleDegree: 5, quality: 'major', seventh: 'dom7' }),
        ],
        notes: [[note({ id: noteId(21), beat: 0, scaleDegree: 1 })], [note({ id: noteId(22), beat: 96, scaleDegree: 5 })], [], []],
      },
      {
        id: measureId(9),
        chords: [
          chord({ id: chordId(17), beat: 0, scaleDegree: 4, quality: 'minor', borrowed: 'minor', duration: 72 }),
          chord({ id: chordId(18), beat: 72, scaleDegree: 5, quality: 'major', seventh: 'dom7', duration: 72 }),
        ],
        notes: [
          [note({ id: noteId(23), beat: 0, scaleDegree: 4 }), note({ id: noteId(24), beat: 72, scaleDegree: 5 })],
          [note({ id: noteId(25), beat: 24, scaleDegree: 6 }), note({ id: noteId(26), beat: 96, scaleDegree: 7 })],
          [],
          [],
        ],
        changes: { tempo: 240, meter: { numerator: 3, denominator: 4 } },
      },
      {
        id: measureId(10),
        chords: [
          chord({ id: chordId(19), beat: 0, scaleDegree: 1, quality: 'minor', seventh: 'min7', duration: 72 }),
          chord({ id: chordId(20), beat: 72, scaleDegree: 5, quality: 'major', seventh: 'dom7', duration: 72 }),
        ],
        notes: [[note({ id: noteId(27), beat: 0, scaleDegree: 1 })], [note({ id: noteId(28), beat: 72, scaleDegree: 3 })], [], []],
      },
    ],
  };
}
