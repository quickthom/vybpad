import type { ChordEvent, NoteEvent, SongData } from '@vybpad/shared';

/** Deterministic UUIDs for stable API seeds (PAT-003 style; matches phase5 fixture pattern). */
function measureId(n: number): string {
  return `7e100000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
function chordId(n: number): string {
  return `7e200000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
function noteId(n: number): string {
  return `7e300000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function chord(p: Partial<ChordEvent> & Pick<ChordEvent, 'id' | 'beat' | 'duration' | 'scaleDegree'>): ChordEvent {
  return {
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    ...p,
  };
}

function note(p: Partial<NoteEvent> & Pick<NoteEvent, 'id' | 'beat' | 'duration'>): NoteEvent {
  return {
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    isRest: false,
    velocity: 100,
    ...p,
  };
}

const defaultBand = {
  tracks: [
    { role: 'melody1' as const, instrument: 'piano' as const, volume: 0.8, mute: false, octave: 0 },
    { role: 'melody2' as const, instrument: 'piano' as const, volume: 0.6, mute: false, octave: 0 },
    { role: 'melody3' as const, instrument: 'piano' as const, volume: 0.6, mute: true, octave: 0 },
    { role: 'melody4' as const, instrument: 'piano' as const, volume: 0.6, mute: true, octave: 0 },
    { role: 'harmony' as const, instrument: 'piano' as const, volume: 0.5, mute: false, octave: 0 },
    { role: 'bass' as const, instrument: 'piano' as const, volume: 0.5, mute: false, octave: -1 },
    { role: 'drums' as const, instrument: 'piano' as const, volume: 0.0, mute: true, octave: 0 },
  ],
};

/** One diatonic chord (96 ticks) — duration shortcut resize (TASK-7.2). */
export function buildShortcutSongChordDuration(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-7.10 shortcut E2E — duration',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    bandConfig: defaultBand,
    measures: [
      {
        id: measureId(0),
        chords: [
          chord({
            id: chordId(1),
            beat: 0,
            duration: 96,
            scaleDegree: 1,
          }),
        ],
        notes: [[], [], [], []],
        changes: undefined,
      },
      ...Array.from({ length: 7 }, (_, i) => ({
        id: measureId(i + 1),
        chords: [] as ChordEvent[],
        notes: [[], [], [], []] as NoteEvent[][],
        changes: undefined,
      })),
    ],
  };
}

/** Two chords in one measure — ArrowLeft/ArrowRight selection navigation (TASK-7.5). */
export function buildShortcutSongTwoChords(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-7.10 shortcut E2E — two chords',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    bandConfig: defaultBand,
    measures: [
      {
        id: measureId(0),
        chords: [
          chord({ id: chordId(1), beat: 0, duration: 48, scaleDegree: 1 }),
          chord({ id: chordId(2), beat: 48, duration: 48, scaleDegree: 5 }),
        ],
        notes: [[], [], [], []],
        changes: undefined,
      },
      ...Array.from({ length: 7 }, (_, i) => ({
        id: measureId(i + 1),
        chords: [] as ChordEvent[],
        notes: [[], [], [], []] as NoteEvent[][],
        changes: undefined,
      })),
    ],
  };
}

/** Half-note melody — split (TASK-7.3). */
export function buildShortcutSongSplitNote(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-7.10 shortcut E2E — split',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    bandConfig: defaultBand,
    measures: [
      {
        id: measureId(0),
        chords: [],
        notes: [
          [note({ id: noteId(1), beat: 0, duration: 96, scaleDegree: 1 })],
          [],
          [],
          [],
        ],
        changes: undefined,
      },
      ...Array.from({ length: 7 }, (_, i) => ({
        id: measureId(i + 1),
        chords: [] as ChordEvent[],
        notes: [[], [], [], []] as NoteEvent[][],
        changes: undefined,
      })),
    ],
  };
}

/** Adjacent eighths same pitch — tie (TASK-7.3). */
export function buildShortcutSongTieNotes(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-7.10 shortcut E2E — tie',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    bandConfig: defaultBand,
    measures: [
      {
        id: measureId(0),
        chords: [],
        notes: [
          [
            note({ id: noteId(10), beat: 0, duration: 24, scaleDegree: 1 }),
            note({ id: noteId(11), beat: 24, duration: 24, scaleDegree: 1 }),
          ],
          [],
          [],
          [],
        ],
        changes: undefined,
      },
      ...Array.from({ length: 7 }, (_, i) => ({
        id: measureId(i + 1),
        chords: [] as ChordEvent[],
        notes: [[], [], [], []] as NoteEvent[][],
        changes: undefined,
      })),
    ],
  };
}

/** Quarter note — triplet toggle 48 ↔ 32 (TASK-7.3). */
export function buildShortcutSongTripletNote(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-7.10 shortcut E2E — triplet',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    bandConfig: defaultBand,
    measures: [
      {
        id: measureId(0),
        chords: [],
        notes: [[note({ id: noteId(20), beat: 0, duration: 48, scaleDegree: 1 })], [], [], []],
        changes: undefined,
      },
      {
        id: measureId(1),
        chords: [],
        notes: [[], [], [], []],
        changes: undefined,
      },
      ...Array.from({ length: 6 }, (_, i) => ({
        id: measureId(i + 2),
        chords: [] as ChordEvent[],
        notes: [[], [], [], []] as NoteEvent[][],
        changes: undefined,
      })),
    ],
  };
}

/** Note in m0 + empty m1 — clipboard paste anchor (TASK-7.4). */
export function buildShortcutSongClipboard(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-7.10 shortcut E2E — clipboard',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    bandConfig: defaultBand,
    measures: [
      {
        id: measureId(0),
        chords: [],
        notes: [[note({ id: noteId(30), beat: 0, duration: 48, scaleDegree: 1 })], [], [], []],
        changes: undefined,
      },
      {
        id: measureId(1),
        chords: [],
        notes: [[], [], [], []],
        changes: undefined,
      },
      ...Array.from({ length: 6 }, (_, i) => ({
        id: measureId(i + 2),
        chords: [] as ChordEvent[],
        notes: [[], [], [], []] as NoteEvent[][],
        changes: undefined,
      })),
    ],
  };
}
