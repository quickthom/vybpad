/**
 * Zustand song document store with Immer and undo/redo (TASK-2.1).
 *
 * loadSong: replaces `song`, clears both undo stacks (past and future), and sets
 * `isDirty` to false — the loaded snapshot is treated as the last-saved baseline.
 * Undo/redo then mark the document dirty again, consistent with "unsaved changes".
 */

import { current } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type {
  BandConfig,
  ChordEditAction,
  ChordEvent,
  Measure,
  MeasureChanges,
  NoteEditAction,
  NoteEvent,
  SongData,
  SongMetadata,
} from '@vybpad/shared';

import { mergeMeasureChanges } from '../utils/measureChangeValidation';

/** PAT-009: match Hookpad — cap undo history length. */
const UNDO_LIMIT = 20;

const DEFAULT_BAND_TRACKS: BandConfig['tracks'] = [
  { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
  { role: 'melody2', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
  { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
  { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
  { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
  { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
  { role: 'drums', instrument: 'piano', volume: 0.0, mute: true, octave: 0 },
];

/**
 * Default empty song aligned with INTERFACES.md `DEFAULT_SONG` / server `buildDefaultSong`.
 * Measure ids are fresh UUIDs per PAT-003 (do not import server code).
 */
export function buildDefaultSong(): SongData {
  const measures: Measure[] = Array.from({ length: 8 }, () => ({
    id: crypto.randomUUID(),
    chords: [],
    notes: [[], [], [], []],
    changes: undefined,
  }));

  return {
    version: '1.0',
    metadata: {
      title: 'Untitled',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures,
    bandConfig: {
      tracks: DEFAULT_BAND_TRACKS.map((t) => ({ ...t })),
    },
  };
}

/** Public contract from INTERFACES.md § Zustand Store Shape. */
export interface SongStore {
  song: SongData;
  isDirty: boolean;

  editChord: (measureIndex: number, action: ChordEditAction) => void;
  editNote: (measureIndex: number, voice: number, action: NoteEditAction) => void;
  /**
   * TASK-7.3 — Apply multiple note edits in one Immer transaction → **one** undo step (PAT-009).
   * Client extension: not yet listed in INTERFACES.md `SongStore` — TL may promote to shared contract.
   */
  editNoteBatch: (
    operations: ReadonlyArray<{ measureIndex: number; voice: 0 | 1 | 2 | 3; action: NoteEditAction }>,
  ) => void;
  setMeasureChanges: (measureIndex: number, changes: MeasureChanges) => void;
  addMeasures: (atIndex: number, count: number) => void;
  deleteMeasures: (start: number, end: number) => void;
  updateMetadata: (changes: Partial<SongMetadata>) => void;
  updateBandConfig: (changes: Partial<BandConfig>) => void;
  loadSong: (song: SongData) => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

type SongStoreState = SongStore & {
  /** Undo stack: snapshots of `song` before each user mutation (not exposed in INTERFACES). */
  _undoPast: SongData[];
  _undoFuture: SongData[];
};

function sortChords(chords: ChordEvent[]): void {
  chords.sort((a, b) => a.beat - b.beat);
}

function sortNotes(notes: NoteEvent[]): void {
  notes.sort((a, b) => a.beat - b.beat);
}

function applyChordEdit(measure: Measure, action: ChordEditAction): void {
  switch (action.type) {
    case 'add': {
      const id = crypto.randomUUID();
      measure.chords.push({ ...action.chord, id });
      sortChords(measure.chords);
      break;
    }
    case 'delete': {
      const idx = measure.chords.findIndex((c) => c.id === action.chordId);
      if (idx >= 0) measure.chords.splice(idx, 1);
      break;
    }
    case 'move': {
      const chord = measure.chords.find((c) => c.id === action.chordId);
      if (chord) {
        chord.beat = action.newBeat;
        sortChords(measure.chords);
      }
      break;
    }
    case 'resize': {
      const chord = measure.chords.find((c) => c.id === action.chordId);
      if (chord) chord.duration = action.newDuration;
      break;
    }
    case 'update': {
      const chord = measure.chords.find((c) => c.id === action.chordId);
      if (chord) {
        const { id: _ignore, ...rest } = action.changes;
        void _ignore;
        Object.assign(chord, rest, { id: chord.id });
      }
      break;
    }
  }
}

function applyNoteEdit(measure: Measure, voice: number, action: NoteEditAction): void {
  if (voice < 0 || voice > 3) return;
  const lane = measure.notes[voice];

  switch (action.type) {
    case 'add': {
      const id = crypto.randomUUID();
      lane.push({ ...action.note, id });
      sortNotes(lane);
      break;
    }
    case 'delete': {
      const idx = lane.findIndex((n) => n.id === action.noteId);
      if (idx >= 0) lane.splice(idx, 1);
      break;
    }
    case 'move': {
      const note = lane.find((n) => n.id === action.noteId);
      if (note) {
        note.beat = action.newBeat;
        if (action.newScaleDegree !== undefined) note.scaleDegree = action.newScaleDegree;
        if (action.newOctave !== undefined) note.octave = action.newOctave;
        sortNotes(lane);
      }
      break;
    }
    case 'resize': {
      const note = lane.find((n) => n.id === action.noteId);
      if (note) note.duration = action.newDuration;
      break;
    }
    case 'update': {
      const note = lane.find((n) => n.id === action.noteId);
      if (note) {
        const { id: _ignore, ...rest } = action.changes;
        void _ignore;
        Object.assign(note, rest, { id: note.id });
      }
      break;
    }
  }
}

function pushUndoSnapshot(draft: SongStoreState): void {
  draft._undoPast.push(structuredClone(current(draft.song)));
  if (draft._undoPast.length > UNDO_LIMIT) draft._undoPast.shift();
  draft._undoFuture = [];
}

function afterMutation(draft: SongStoreState): void {
  draft.isDirty = true;
  draft.canUndo = draft._undoPast.length > 0;
  draft.canRedo = false;
}

export const useSongStore = create<SongStoreState>()(
  immer((set, get) => ({
    song: buildDefaultSong(),
    isDirty: false,
    canUndo: false,
    canRedo: false,
    _undoPast: [],
    _undoFuture: [],

    editChord: (measureIndex, action) => {
      set((draft) => {
        const measure = draft.song.measures[measureIndex];
        if (!measure) return;
        pushUndoSnapshot(draft);
        applyChordEdit(measure, action);
        afterMutation(draft);
      });
    },

    editNote: (measureIndex, voice, action) => {
      if (voice < 0 || voice > 3) return;
      set((draft) => {
        const measure = draft.song.measures[measureIndex];
        if (!measure) return;
        pushUndoSnapshot(draft);
        applyNoteEdit(measure, voice, action);
        afterMutation(draft);
      });
    },

    editNoteBatch: (operations) => {
      if (operations.length === 0) return;
      set((draft) => {
        pushUndoSnapshot(draft);
        for (const op of operations) {
          const measure = draft.song.measures[op.measureIndex];
          if (!measure || op.voice < 0 || op.voice > 3) continue;
          applyNoteEdit(measure, op.voice, op.action);
        }
        afterMutation(draft);
      });
    },

    setMeasureChanges: (measureIndex, changes) => {
      set((draft) => {
        const measure = draft.song.measures[measureIndex];
        if (!measure) return;
        pushUndoSnapshot(draft);
        const merged = mergeMeasureChanges(measure.changes, changes);
        const empty =
          merged.key === undefined &&
          merged.scale === undefined &&
          merged.tempo === undefined &&
          merged.meter === undefined;
        measure.changes = empty ? undefined : merged;
        afterMutation(draft);
      });
    },

    addMeasures: (atIndex, count) => {
      if (count <= 0) return;
      set((draft) => {
        pushUndoSnapshot(draft);
        const insertAt = Math.max(0, Math.min(atIndex, draft.song.measures.length));
        const newMeasures: Measure[] = Array.from({ length: count }, () => ({
          id: crypto.randomUUID(),
          chords: [],
          notes: [[], [], [], []],
          changes: undefined,
        }));
        draft.song.measures.splice(insertAt, 0, ...newMeasures);
        afterMutation(draft);
      });
    },

    deleteMeasures: (start, end) => {
      if (start > end || start < 0) return;
      set((draft) => {
        if (start >= draft.song.measures.length) return;
        pushUndoSnapshot(draft);
        const last = Math.min(end, draft.song.measures.length - 1);
        const del = last - start + 1;
        draft.song.measures.splice(start, del);
        afterMutation(draft);
      });
    },

    updateMetadata: (changes) => {
      set((draft) => {
        pushUndoSnapshot(draft);
        Object.assign(draft.song.metadata, changes);
        afterMutation(draft);
      });
    },

    updateBandConfig: (changes) => {
      set((draft) => {
        pushUndoSnapshot(draft);
        const { tracks, ...rest } = changes;
        Object.assign(draft.song.bandConfig, rest);
        if (tracks) {
          for (const incoming of tracks) {
            const idx = draft.song.bandConfig.tracks.findIndex((t) => t.role === incoming.role);
            if (idx >= 0) Object.assign(draft.song.bandConfig.tracks[idx], incoming);
          }
        }
        afterMutation(draft);
      });
    },

    loadSong: (song) => {
      set((draft) => {
        draft.song = structuredClone(song);
        draft._undoPast = [];
        draft._undoFuture = [];
        draft.isDirty = false;
        draft.canUndo = false;
        draft.canRedo = false;
      });
    },

    undo: () => {
      if (get()._undoPast.length === 0) return;
      set((draft) => {
        const prev = draft._undoPast.pop()!;
        draft._undoFuture.unshift(structuredClone(current(draft.song)));
        draft.song = prev;
        draft.isDirty = true;
        draft.canUndo = draft._undoPast.length > 0;
        draft.canRedo = draft._undoFuture.length > 0;
      });
    },

    redo: () => {
      if (get()._undoFuture.length === 0) return;
      set((draft) => {
        const next = draft._undoFuture.shift()!;
        draft._undoPast.push(structuredClone(current(draft.song)));
        if (draft._undoPast.length > UNDO_LIMIT) draft._undoPast.shift();
        draft.song = next;
        draft.isDirty = true;
        draft.canUndo = draft._undoPast.length > 0;
        draft.canRedo = draft._undoFuture.length > 0;
      });
    },
  })),
);
