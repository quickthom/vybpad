/**
 * TASK-7.3 — chord strings for split / tie / triplet editor shortcuts (PAT-027).
 * Must match {@link tokenFromKeyboardEventKey} / {@link chordFromKeyboardEvent} for the physical keys
 * (`/` yields `Slash`, not `/` after normalization — see {@link normalizeChord} vs dispatch).
 */
export const TASK73_EDITOR_SHORTCUT_CHORDS = {
  splitSelection: 'Slash',
  tieSelection: 'T',
  toggleTriplet: 'Shift+T',
} as const;
