import type { ChordEvent, NoteEvent, NoteName, ScaleType, TimeSignature } from "./music.js";

export interface MeasureChanges {
  key?: NoteName; // key change at start of this measure
  scale?: ScaleType; // scale/mode change
  tempo?: number; // BPM (positive integer, 20–300)
  meter?: TimeSignature; // time signature change
}

export interface Measure {
  id: string; // UUID
  chords: ChordEvent[]; // sorted by beat ascending
  notes: [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]]; // voices 0–3; each sorted by beat ascending
  changes?: MeasureChanges; // undefined → inherits from previous measure (or song metadata for measure 0)
}

export interface SongMetadata {
  title: string; // 0–200 chars
  key: NoteName; // initial tonic
  scale: ScaleType; // initial scale/mode
  tempo: number; // initial BPM (20–300)
  meter: TimeSignature; // initial time signature
}

export interface SongData {
  version: "1.0"; // schema version for future migration
  metadata: SongMetadata;
  measures: Measure[]; // ordered; index = measure number
  bandConfig: BandConfig;
}

export type TrackRole =
  | "melody1"
  | "melody2"
  | "melody3"
  | "melody4"
  | "harmony"
  | "bass"
  | "drums";

export interface Track {
  role: TrackRole;
  instrument: string; // instrument identifier (MVP: always "piano")
  volume: number; // 0.0–1.0 (clamped)
  mute: boolean;
  octave: number; // voicing center offset in octaves (integer, -2 to +2)
}

export interface BandConfig {
  tracks: Track[]; // one per TrackRole; order matches TrackRole enum order
}
