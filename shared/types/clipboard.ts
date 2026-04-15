import type { ChordEvent, NoteEvent } from './music.js';
import type { Selection } from './editor.js';
import type { MeasureChanges } from './song.js';

/** INTERFACES.md — clipboard measure slice (TASK-7.4 / PAT-028). */
export interface ClipboardMeasureSlice {
  measureOffset: number;
  chords: ChordEvent[];
  notes: NoteEvent[][];
  changes?: MeasureChanges;
}

/** INTERFACES.md — v1 selection clipboard JSON (`text/plain`). */
export interface SelectionClipboardPayload {
  version: 1;
  kind: 'selection';
  source: 'vybpad';
  copiedAt: string;
  selection: Selection;
  measures: ClipboardMeasureSlice[];
}
