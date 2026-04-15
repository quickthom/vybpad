/**
 * Client mirrors INTERFACES.md shortcut types (canonical doc). Keep aligned on changes.
 */

export type ShortcutScope = 'global' | 'editor' | 'panel' | 'input';

export type ShortcutConflictPolicy = 'warn' | 'replace' | 'ignore';

export type ShortcutChord = string;

export type ShortcutCommandId =
  | 'toggleEntryMode'
  | 'setNoteDurationWhole'
  | 'setNoteDurationHalf'
  | 'setNoteDurationQuarter'
  | 'setNoteDurationEighth'
  | 'setNoteDurationSixteenth'
  | 'setNoteDurationThirtySecond'
  | 'splitSelection'
  | 'tieSelection'
  | 'toggleTriplet'
  | 'copySelection'
  | 'pasteSelection'
  | 'zoomIn'
  | 'zoomOut'
  | 'resetZoom'
  | 'scrollUp'
  | 'scrollDown'
  | 'moveSelectionLeft'
  | 'moveSelectionRight'
  | 'playPause'
  | 'stopPlayback'
  | 'rewindPlayback';

export interface ShortcutDefinition {
  id: ShortcutCommandId;
  chord: ShortcutChord;
  scope: ShortcutScope;
  enabled?: boolean;
  conflictPolicy?: ShortcutConflictPolicy;
}

export interface ShortcutContext {
  hasModalOpen: boolean;
  isTextEditing: boolean;
  hasEditorFocus: boolean;
  isPlaying: boolean;
}

export interface ShortcutManager {
  registerShortcut: (shortcut: ShortcutDefinition) => () => void;
  unregisterShortcut: (id: ShortcutCommandId) => void;
  handleKeyDown: (event: KeyboardEvent, context: ShortcutContext) => boolean;
}

/** Higher number = more specific (PAT-027 “most specific scope wins”). */
export const SPECIFICITY_ORDER: Record<ShortcutScope, number> = {
  global: 0,
  panel: 1,
  editor: 2,
  input: 3,
};
