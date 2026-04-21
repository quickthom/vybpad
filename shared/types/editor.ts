import type { ChordEvent, NoteEvent, ScaleDegree } from './music.js';

export interface Viewport {
  startMeasure: number; // first visible measure index
  measureCount: number; // how many measures visible
  scrollY: number; // vertical scroll offset (for pitch range)
  zoom: number; // horizontal zoom level (1.0 = default)
  /** Vertical zoom for melody row scale (1.0 = default). UI-R2-W7.2 / RA-210; omit in persisted snapshots → treat as 1. */
  zoomY?: number;
}

export interface Selection {
  type: 'chord' | 'note' | 'range';
  measureIndex: number;
  eventIds?: string[]; // selected chord or note IDs
  rangeStart?: number; // tick position for range selection
  rangeEnd?: number;
}

export type ChordEditAction =
  | { type: 'add'; chord: Omit<ChordEvent, 'id'> }
  | { type: 'delete'; chordId: string }
  | { type: 'move'; chordId: string; newBeat: number }
  | { type: 'resize'; chordId: string; newDuration: number }
  | { type: 'update'; chordId: string; changes: Partial<ChordEvent> };

export type NoteEditAction =
  | { type: 'add'; note: Omit<NoteEvent, 'id'> }
  | { type: 'delete'; noteId: string }
  | {
      type: 'move';
      noteId: string;
      newBeat: number;
      newScaleDegree?: ScaleDegree;
      newOctave?: number;
    }
  | { type: 'resize'; noteId: string; newDuration: number }
  | { type: 'update'; noteId: string; changes: Partial<NoteEvent> };
