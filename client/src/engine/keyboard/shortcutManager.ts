/**
 * Phase 7.1 — Shortcut registry foundation (INTERFACES.md `ShortcutManager`, PAT-027).
 *
 * QA placeholder: `createShortcutManager` is intentionally incomplete so failing tests can land first.
 * The Builder replaces this with a full PAT-027 implementation (normalization, scope, conflicts, context).
 */

import type {
  ShortcutCommandId,
  ShortcutContext,
  ShortcutDefinition,
  ShortcutManager,
} from './shortcutTypes';

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
 * Re-exported for unit tests; the full manager must use the same normalization on register and on dispatch.
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
  // Defer Arrow*, F*, etc. — preserve first-char casing pattern from segment
  return t;
}

/** Maps a DOM keydown to the same normalized token used in {@link normalizeChord} for the key slot. */
export function tokenFromKeyboardEventKey(key: string, code?: string): string {
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  if (key === 'Escape') return 'Escape';
  if (key.startsWith('Arrow')) return key;
  if (code?.startsWith('Digit')) return code.replace('Digit', '');
  if (code?.startsWith('Key')) return code.slice(3);
  return key;
}

export type CreateShortcutManagerOptions = {
  onCommand: (id: ShortcutCommandId) => void;
};

/**
 * @returns `ShortcutManager` — **stub**: {@link ShortcutManager.handleKeyDown} always returns `false`
 * until the Builder wires PAT-027 dispatch (QA baseline should fail on positive-path tests).
 */
export function createShortcutManager(_options: CreateShortcutManagerOptions): ShortcutManager {
  const registry = new Map<string, ShortcutDefinition>();

  return {
    registerShortcut(shortcut: ShortcutDefinition): () => void {
      const chord = normalizeChord(shortcut.chord);
      registry.set(`${shortcut.scope}::${chord}`, { ...shortcut, chord });
      return () => {
        const k = `${shortcut.scope}::${chord}`;
        registry.delete(k);
      };
    },

    unregisterShortcut(id: ShortcutCommandId): void {
      for (const [k, def] of registry) {
        if (def.id === id) registry.delete(k);
      }
    },

    handleKeyDown(_event: KeyboardEvent, _context: ShortcutContext): boolean {
      void _event;
      void _context;
      /* Builder: resolve _event → normalized chord, apply PAT-027 + ShortcutContext gates, then dispatch. */
      return false;
    },
  };
}
