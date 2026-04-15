/**
 * Phase 7.1 — Shortcut registry (INTERFACES.md `ShortcutManager`, PAT-027).
 *
 * Normalizes chords, resolves conflicts by scope and policy, and gates on {@link ShortcutContext}.
 */

import type {
  ShortcutCommandId,
  ShortcutContext,
  ShortcutDefinition,
  ShortcutManager,
  ShortcutScope,
} from './shortcutTypes';

import { SPECIFICITY_ORDER } from './shortcutTypes';

export type {
  ShortcutChord,
  ShortcutCommandId,
  ShortcutConflictPolicy,
  ShortcutContext,
  ShortcutDefinition,
  ShortcutManager,
  ShortcutScope,
} from './shortcutTypes';

export { SPECIFICITY_ORDER } from './shortcutTypes';

/** PAT-027 / INTERFACES.md — canonical modifier order for normalized chords. */
const MOD_ORDER = ['Ctrl', 'Alt', 'Meta', 'Shift'] as const;

/**
 * Normalizes a human-entered chord string (e.g. "ctrl+shift+t") to canonical form "Ctrl+Shift+T".
 * Re-exported for unit tests; register and dispatch must use the same normalization.
 */
export function normalizeChord(raw: string): string {
  const segments = raw
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return '';

  const mods = new Set<string>();
  let mainKey = '';

  for (const seg of segments) {
    const lower = seg.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') mods.add('Ctrl');
    else if (lower === 'alt' || lower === 'option') mods.add('Alt');
    else if (lower === 'meta' || lower === 'cmd' || lower === 'command') mods.add('Meta');
    else if (lower === 'shift') mods.add('Shift');
    else {
      mainKey = formatMainKey(seg);
    }
  }

  const orderedMods = MOD_ORDER.filter((m) => mods.has(m));
  if (!mainKey) return orderedMods.join('+');

  return [...orderedMods, mainKey].join('+');
}

function formatMainKey(seg: string): string {
  const t = seg.trim();
  if (t === ' ') return 'Space';
  if (t.length === 1) return t.toUpperCase();
  const lower = t.toLowerCase();
  if (lower === 'space') return 'Space';
  return t;
}

/**
 * Maps a DOM keydown to the same normalized token used in {@link normalizeChord} for the key slot
 * (after modifier segments).
 */
export function tokenFromKeyboardEventKey(key: string, code?: string): string {
  if (key === ' ') return 'Space';
  // Align punctuation with named chord segments used in registrations (e.g. Ctrl+Equals).
  if (code === 'Equal' && key === '=') return 'Equals';
  if (code === 'Minus' && key === '-') return 'Minus';
  if (code === 'BracketLeft') return 'BracketLeft';
  if (code === 'BracketRight') return 'BracketRight';
  if (code === 'Slash' && key === '/') return 'Slash';
  if (code === 'Backslash') return 'Backslash';
  // TASK-7.5 transport: match `normalizeChord('.')` / `normalizeChord(',')` registrations regardless of
  // whether the runtime exposes `key` or `code` (browser vs jsdom variance).
  if (code === 'Period' || key === '.') return '.';
  if (code === 'Comma' || key === ',') return ',';
  if (key.length === 1) return key.toUpperCase();
  if (key === 'Escape') return 'Escape';
  if (key.startsWith('Arrow')) return key;
  if (code?.startsWith('Digit')) return code.replace('Digit', '');
  if (code?.startsWith('Key')) return code.slice(3);
  return key;
}

/** Builds the full normalized chord string for a keydown event (modifiers + main key). */
export function chordFromKeyboardEvent(event: KeyboardEvent): string {
  const mods = new Set<string>();
  if (event.ctrlKey) mods.add('Ctrl');
  if (event.altKey) mods.add('Alt');
  if (event.metaKey) mods.add('Meta');
  if (event.shiftKey) mods.add('Shift');
  const orderedMods = MOD_ORDER.filter((m) => mods.has(m));
  const main = tokenFromKeyboardEventKey(event.key, event.code);
  if (!main) return orderedMods.join('+');
  return [...orderedMods, main].join('+');
}

function effectiveConflictPolicy(p: ShortcutDefinition['conflictPolicy']): 'replace' | 'ignore' {
  return p === 'ignore' || p === 'warn' ? 'ignore' : 'replace';
}

/** Whether a binding may run in the given context (modal/text/scope/editor focus). */
function isActiveInContext(def: ShortcutDefinition, context: ShortcutContext): boolean {
  if (def.enabled === false) return false;
  if (context.hasModalOpen) return false;

  if (context.isTextEditing) {
    if (def.scope !== 'input') return false;
  } else {
    if (def.scope === 'input') return false;
  }

  switch (def.scope) {
    case 'global':
      return true;
    case 'panel':
    case 'editor':
      return context.hasEditorFocus;
    case 'input':
      return context.isTextEditing;
    default:
      return false;
  }
}

function shouldReplaceExisting(
  existing: ShortcutDefinition,
  incoming: ShortcutDefinition,
): boolean {
  if (effectiveConflictPolicy(existing.conflictPolicy) === 'ignore') {
    return false;
  }
  return effectiveConflictPolicy(incoming.conflictPolicy) === 'replace';
}

export type CreateShortcutManagerOptions = {
  onCommand: (id: ShortcutCommandId) => void;
};

type ChordRegistry = Map<ShortcutScope, ShortcutDefinition>;

/**
 * Single shortcut registry: normalized chords, scope precedence, conflict policy, and context gating.
 */
export function createShortcutManager(options: CreateShortcutManagerOptions): ShortcutManager {
  const { onCommand } = options;
  /** normalized chord string → one definition per scope (conflicts resolved at register time). */
  const byChord = new Map<string, ChordRegistry>();
  /** Track all registry keys per command id for {@link unregisterShortcut}. */
  const idsToKeys = new Map<ShortcutCommandId, Set<string>>();

  function addIdKey(id: ShortcutCommandId, chordNorm: string, scope: ShortcutScope): void {
    let set = idsToKeys.get(id);
    if (!set) {
      set = new Set();
      idsToKeys.set(id, set);
    }
    set.add(`${scope}::${chordNorm}`);
  }

  function removeIdKey(id: ShortcutCommandId, chordNorm: string, scope: ShortcutScope): void {
    const set = idsToKeys.get(id);
    if (!set) return;
    set.delete(`${scope}::${chordNorm}`);
    if (set.size === 0) idsToKeys.delete(id);
  }

  return {
    registerShortcut(shortcut: ShortcutDefinition): () => void {
      const chordNorm = normalizeChord(shortcut.chord);
      if (!chordNorm) {
        return () => {};
      }

      let scopeMap = byChord.get(chordNorm);
      if (!scopeMap) {
        scopeMap = new Map();
        byChord.set(chordNorm, scopeMap);
      }

      const existing = scopeMap.get(shortcut.scope);
      if (existing) {
        if (!shouldReplaceExisting(existing, shortcut)) {
          return () => {};
        }
        removeIdKey(existing.id, chordNorm, shortcut.scope);
      }

      const def = { ...shortcut, chord: chordNorm };
      scopeMap.set(shortcut.scope, def);
      addIdKey(shortcut.id, chordNorm, shortcut.scope);

      return () => {
        const sm = byChord.get(chordNorm);
        if (!sm) return;
        const cur = sm.get(shortcut.scope);
        if (cur?.id === shortcut.id) {
          sm.delete(shortcut.scope);
          removeIdKey(shortcut.id, chordNorm, shortcut.scope);
          if (sm.size === 0) {
            byChord.delete(chordNorm);
          }
        }
      };
    },

    unregisterShortcut(id: ShortcutCommandId): void {
      const keys = idsToKeys.get(id);
      if (!keys) return;
      for (const composite of [...keys]) {
        const [scope, chordNorm] = composite.split('::') as [ShortcutScope, string];
        const sm = byChord.get(chordNorm);
        if (!sm) continue;
        const cur = sm.get(scope);
        if (cur?.id === id) {
          sm.delete(scope);
          if (sm.size === 0) {
            byChord.delete(chordNorm);
          }
        }
      }
      idsToKeys.delete(id);
    },

    handleKeyDown(event: KeyboardEvent, context: ShortcutContext): boolean {
      if (event.isComposing) {
        return false;
      }

      const chordNorm = chordFromKeyboardEvent(event);
      if (!chordNorm) {
        return false;
      }

      const scopeMap = byChord.get(chordNorm);
      if (!scopeMap || scopeMap.size === 0) {
        return false;
      }

      let winner: ShortcutDefinition | null = null;
      let winnerSpec = -1;

      for (const def of scopeMap.values()) {
        if (!isActiveInContext(def, context)) continue;
        const spec = SPECIFICITY_ORDER[def.scope];
        if (spec > winnerSpec) {
          winnerSpec = spec;
          winner = def;
        }
      }

      if (!winner) {
        return false;
      }

      onCommand(winner.id);
      event.preventDefault();
      return true;
    },
  };
}
