import type { NoteName } from '@vybpad/shared';

/** Pitch class 0–11 for each note name (C = 0, C# = 1, …, B = 11). */
const NOTE_TO_MIDI_BASE: Record<NoteName, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

/** Maps a note name to its chromatic pitch class (MIDI mod 12). */
export function noteNameToMidiBase(note: NoteName): number {
  return NOTE_TO_MIDI_BASE[note];
}
