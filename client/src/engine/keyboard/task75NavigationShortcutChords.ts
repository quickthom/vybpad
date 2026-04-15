/**
 * TASK-7.5 — default chord registrations for navigation + transport (PAT-027, INTERFACES `ShortcutCommandId`).
 *
 * - Editor-scoped: zoom, scroll, selection — require canvas focus (`ShortcutContext.hasEditorFocus`).
 * - Global-scoped: transport — work from the shell without canvas focus; still blocked when
 *   `hasModalOpen` or `isTextEditing` (same as other globals).
 *
 * Chords use {@link normalizeChord} canonical form (`Ctrl+Equals`, `Space`, …).
 */
export const TASK75_NAVIGATION_SHORTCUT_CHORDS = {
  zoomInPrimary: 'Ctrl+Equals',
  /** Physical `+` / `=` with Shift — browsers report `=` + Shift. */
  zoomInShifted: 'Ctrl+Shift+Equals',
  zoomOut: 'Ctrl+Minus',
  resetZoom: 'Ctrl+0',
  scrollUp: 'ArrowUp',
  scrollDown: 'ArrowDown',
  moveSelectionLeft: 'ArrowLeft',
  moveSelectionRight: 'ArrowRight',
} as const;

/**
 * Physical keys Period / Comma register as `.` / `,` so {@link chordFromKeyboardEvent} matches
 * (see {@link tokenFromKeyboardEventKey} — `key` is one character for those keys).
 */
export const TASK75_TRANSPORT_SHORTCUT_CHORDS = {
  playPause: 'Space',
  stopPlayback: '.',
  rewindPlayback: ',',
} as const;
