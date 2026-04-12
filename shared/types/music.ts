export type NoteName =
  | "C"
  | "C#"
  | "D"
  | "D#"
  | "E"
  | "F"
  | "F#"
  | "G"
  | "G#"
  | "A"
  | "A#"
  | "B";

export type ScaleType =
  | "major"
  | "minor"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "locrian"
  | "harmonicMinor"
  | "phrygianDominant";

export type ScaleDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface TimeSignature {
  numerator: number; // e.g., 4, 3, 6, 12
  denominator: number; // e.g., 4, 8
}

export type ChordQuality = "major" | "minor" | "diminished" | "augmented";

export type SeventhType = "none" | "maj7" | "min7" | "dom7" | "dim7" | "min7b5";

export type SuspensionType = "none" | "sus2" | "sus4";

export type AdditionType = "none" | "add9" | "add11" | "add13";

export type SecondaryFunction = "V" | "viio" | "IV";

export interface SecondaryChord {
  function: SecondaryFunction; // V/x, viio/x, IV/x
  target: ScaleDegree; // the x
}

export interface ChordEvent {
  id: string; // UUID — stable across undo/redo for selection tracking
  scaleDegree: ScaleDegree; // root scale degree in current key (1–7)
  quality: ChordQuality; // explicitly stored, not inferred (set to diatonic default on creation)
  seventh: SeventhType;
  suspension: SuspensionType;
  addition: AdditionType;
  inversion: 0 | 1 | 2 | 3; // 0=root, 1–3=inversions (3 only valid for 7th chords)
  borrowed: ScaleType | null; // non-null → chord borrowed from this parallel mode
  secondary: SecondaryChord | null; // non-null → applied/secondary chord
  beat: number; // tick offset from measure start (0-based, integer)
  duration: number; // length in ticks (integer, > 0)
}

export interface NoteEvent {
  id: string; // UUID
  scaleDegree: ScaleDegree; // 1–7
  octave: number; // relative octave offset from default range (integer, typically -2 to +2)
  chromatic: number; // semitone offset from diatonic pitch (integer, typically -1, 0, or +1)
  beat: number; // tick offset from measure start (0-based, integer)
  duration: number; // length in ticks (integer, > 0)
  isRest: boolean; // true → rest; scaleDegree/octave/chromatic ignored
  velocity: number; // 1–127 (default 100)
}
