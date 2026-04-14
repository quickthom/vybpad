import type { ChordEvent, SongData } from '@vybpad/shared';

/** Deterministic UUIDs for fixtures (PAT-003 style — stable in tests). */
function measureId(i: number): string {
  return `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
}

function chordId(i: number): string {
  return `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
}

function baseSong(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'QA voicing-heavy fixture',
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
    measures: [],
  };
}

function chord(overrides: Partial<ChordEvent> & Pick<ChordEvent, 'id' | 'beat'>): ChordEvent {
  return {
    scaleDegree: 1,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    duration: 48,
    ...overrides,
  };
}

/** Many diatonic + seventh chords on consecutive beats (voicing engine stress). */
export function buildVoicingHeavySong(): SongData {
  const song = baseSong();
  let cid = 1;
  const measures: SongData['measures'] = [];

  const progression: Omit<ChordEvent, 'id' | 'beat' | 'duration'>[] = [
    { scaleDegree: 1, quality: 'major', seventh: 'maj7', inversion: 0 },
    { scaleDegree: 4, quality: 'major', seventh: 'maj7', inversion: 1 },
    { scaleDegree: 5, quality: 'major', seventh: 'dom7', inversion: 0 },
    { scaleDegree: 1, quality: 'major', seventh: 'maj7', inversion: 2 },
    { scaleDegree: 6, quality: 'minor', seventh: 'min7', inversion: 0 },
    { scaleDegree: 2, quality: 'minor', seventh: 'min7b5', inversion: 1 },
    { scaleDegree: 5, quality: 'major', seventh: 'dom7', inversion: 3 },
    { scaleDegree: 1, quality: 'major', seventh: 'none', inversion: 0 },
  ];

  for (let m = 0; m < 8; m += 1) {
    const row: ChordEvent[] = [];
    for (let b = 0; b < 4; b += 1) {
      const template = progression[(m * 4 + b) % progression.length]!;
      row.push(
        chord({
          id: chordId(cid),
          beat: b * 48,
          ...template,
        }),
      );
      cid += 1;
    }
    measures.push({
      id: measureId(m + 1),
      chords: row,
      notes: [[], [], [], []],
    });
  }

  song.measures = measures;
  return song;
}

/** Borrowed, secondary, and mixed inversions (scenario C — edge progression). */
export function buildEdgeCaseVoicingSong(): SongData {
  const song = baseSong();
  song.metadata.title = 'QA edge voicing fixture';
  song.metadata.key = 'A';
  song.metadata.scale = 'minor';

  const chords: ChordEvent[] = [
    chord({
      id: chordId(1),
      beat: 0,
      scaleDegree: 1,
      quality: 'minor',
      seventh: 'min7',
      inversion: 0,
      borrowed: null,
      secondary: null,
      duration: 96,
    }),
    chord({
      id: chordId(2),
      beat: 96,
      scaleDegree: 4,
      quality: 'minor',
      seventh: 'min7',
      inversion: 2,
      borrowed: 'major',
      secondary: null,
      duration: 96,
    }),
    chord({
      id: chordId(3),
      beat: 0,
      scaleDegree: 5,
      quality: 'major',
      seventh: 'dom7',
      inversion: 1,
      borrowed: null,
      secondary: { function: 'V', target: 4 },
      duration: 96,
    }),
    chord({
      id: chordId(4),
      beat: 96,
      scaleDegree: 1,
      quality: 'minor',
      seventh: 'min7',
      inversion: 3,
      borrowed: null,
      secondary: null,
      duration: 96,
    }),
  ];

  song.measures = [
    {
      id: measureId(1),
      chords: [chords[0]!, chords[1]!],
      notes: [[], [], [], []],
    },
    {
      id: measureId(2),
      chords: [chords[2]!, chords[3]!],
      notes: [[], [], [], []],
    },
    {
      id: measureId(3),
      chords: [],
      notes: [[], [], [], []],
    },
    {
      id: measureId(4),
      chords: [],
      notes: [[], [], [], []],
    },
    {
      id: measureId(5),
      chords: [],
      notes: [[], [], [], []],
    },
    {
      id: measureId(6),
      chords: [],
      notes: [[], [], [], []],
    },
    {
      id: measureId(7),
      chords: [],
      notes: [[], [], [], []],
    },
    {
      id: measureId(8),
      chords: [],
      notes: [[], [], [], []],
    },
  ];

  return song;
}
