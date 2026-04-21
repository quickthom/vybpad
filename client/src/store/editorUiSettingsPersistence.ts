/**
 * Versioned client-only editor UI settings in localStorage (TASK-7.6, INTERFACES.md, ARCHITECTURE.md).
 */

import type { EditorLabelMode, StaffSpacing } from '../types/editorChrome';

/** Stable key: `vybpad:` prefix + `:v1` version suffix (QA contract). */
export const EDITOR_UI_SETTINGS_STORAGE_KEY = 'vybpad:editorUiSettings:v1';

/** Pre–TASK-7.6 draft key; valid v1 JSON is migrated to {@link EDITOR_UI_SETTINGS_STORAGE_KEY} on read. */
const LEGACY_EDITOR_UI_SETTINGS_STORAGE_KEY = 'vybpad:editorSettings:v1';

export interface PersistedEditorUiSettingsV1 {
  version: 1;
  entryMode: 'table' | 'text';
  labelMode: EditorLabelMode;
  colorScheme: 'diatonic' | 'major';
  showGuides: boolean;
  staffSpacing: StaffSpacing;
  /** Horizontal zoom (1.0 = default). Omit when absent in older payloads. */
  zoom?: number;
  /** Vertical melody zoom (1.0 = default). Omit when absent in older payloads. */
  zoomY?: number;
  /** UI-W4 — optional for backward compatibility with older localStorage payloads. */
  melodyVoiceVisible?: readonly [boolean, boolean, boolean, boolean];
  inactiveMelodyDisplayMode?: 'outline' | 'solid' | 'alpha';
  smartOctaveEnabled?: boolean;
}

function isEntryMode(x: unknown): x is 'table' | 'text' {
  return x === 'table' || x === 'text';
}

function isLabelMode(x: unknown): x is EditorLabelMode {
  return x === 'degree' || x === 'roman' || x === 'both' || x === 'off';
}

function isColorScheme(x: unknown): x is 'diatonic' | 'major' {
  return x === 'diatonic' || x === 'major';
}

function isStaffSpacing(x: unknown): x is StaffSpacing {
  return x === 'compact' || x === 'default' || x === 'wide';
}

function isMelodyVoiceVisibleTuple(x: unknown): x is readonly [boolean, boolean, boolean, boolean] {
  return (
    Array.isArray(x) &&
    x.length === 4 &&
    x.every((v) => typeof v === 'boolean')
  );
}

function isInactiveMelodyDisplayMode(x: unknown): x is 'outline' | 'solid' | 'alpha' {
  return x === 'outline' || x === 'solid' || x === 'alpha';
}

function isZoomRatio(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x > 0;
}

function parsePersistedV1(raw: string | null): PersistedEditorUiSettingsV1 | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    if (o.version !== 1) {
      return null;
    }
    if (
      !isEntryMode(o.entryMode) ||
      !isLabelMode(o.labelMode) ||
      !isColorScheme(o.colorScheme) ||
      typeof o.showGuides !== 'boolean' ||
      !isStaffSpacing(o.staffSpacing)
    ) {
      return null;
    }
    const base: PersistedEditorUiSettingsV1 = {
      version: 1,
      entryMode: o.entryMode,
      labelMode: o.labelMode,
      colorScheme: o.colorScheme,
      showGuides: o.showGuides,
      staffSpacing: o.staffSpacing,
    };
    if (o.zoom !== undefined && isZoomRatio(o.zoom)) {
      base.zoom = o.zoom;
    }
    if (o.zoomY !== undefined && isZoomRatio(o.zoomY)) {
      base.zoomY = o.zoomY;
    }
    if (o.melodyVoiceVisible !== undefined && isMelodyVoiceVisibleTuple(o.melodyVoiceVisible)) {
      base.melodyVoiceVisible = o.melodyVoiceVisible;
    }
    if (o.inactiveMelodyDisplayMode !== undefined && isInactiveMelodyDisplayMode(o.inactiveMelodyDisplayMode)) {
      base.inactiveMelodyDisplayMode = o.inactiveMelodyDisplayMode;
    }
    if (o.smartOctaveEnabled !== undefined && typeof o.smartOctaveEnabled === 'boolean') {
      base.smartOctaveEnabled = o.smartOctaveEnabled;
    }
    return base;
  } catch {
    return null;
  }
}

export function readPersistedEditorUiSettings(): PersistedEditorUiSettingsV1 | null {
  const ls = globalThis.localStorage;
  if (!ls || typeof ls.getItem !== 'function') {
    return null;
  }
  const current = parsePersistedV1(ls.getItem(EDITOR_UI_SETTINGS_STORAGE_KEY));
  if (current) {
    return current;
  }
  const legacy = parsePersistedV1(ls.getItem(LEGACY_EDITOR_UI_SETTINGS_STORAGE_KEY));
  if (legacy) {
    writePersistedEditorUiSettings(legacy);
    try {
      ls.removeItem(LEGACY_EDITOR_UI_SETTINGS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return legacy;
  }
  return null;
}

export function writePersistedEditorUiSettings(snapshot: PersistedEditorUiSettingsV1): void {
  const ls = globalThis.localStorage;
  if (!ls || typeof ls.setItem !== 'function') {
    return;
  }
  try {
    ls.setItem(EDITOR_UI_SETTINGS_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}
