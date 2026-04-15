/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — TASK-7.6 (localStorage)
 *
 * Criterion — INTERFACES EditorSettingsPanel note + ARCHITECTURE: client-only JSON persistence
 *   under one versioned localStorage key (no server preferences API).
 *   happy: exported stable key matches `vybpad:` prefix and `:v<number>` version suffix;
 *     write + read round-trip for full snapshot; setItem stores JSON text.
 *   error: missing key, malformed JSON, or unsupported `version` field → read returns null (no throw).
 *   edges: showGuides false; each enum literal round-trips.
 *
 * Public API expected from `@/store/editorUiSettingsPersistence` (Builder implements):
 *   - EDITOR_UI_SETTINGS_STORAGE_KEY
 *   - readPersistedEditorUiSettings(): snapshot | null
 *   - writePersistedEditorUiSettings(snapshot): void
 *
 * Snapshot shape (version 1) aligns with INTERFACES `EditorSettingsPanelProps` + UIStore fields.
 */

import {
  EDITOR_UI_SETTINGS_STORAGE_KEY,
  readPersistedEditorUiSettings,
  writePersistedEditorUiSettings,
} from '@/store/editorUiSettingsPersistence';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fullV1Snapshot = {
  version: 1 as const,
  entryMode: 'text' as const,
  labelMode: 'roman' as const,
  colorScheme: 'major' as const,
  showGuides: true,
  staffSpacing: 'wide' as const,
};

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('editor UI settings — TASK-7.6 — localStorage persistence contract', () => {
  describe('happy path', () => {
    it('exports a storage key string that starts with "vybpad:" and ends with a :v<number> version segment', () => {
      expect(EDITOR_UI_SETTINGS_STORAGE_KEY.startsWith('vybpad:')).toBe(true);
      expect(EDITOR_UI_SETTINGS_STORAGE_KEY).toMatch(/:v\d+$/);
    });

    it('returns the same snapshot from readPersistedEditorUiSettings after writePersistedEditorUiSettings', () => {
      writePersistedEditorUiSettings(fullV1Snapshot);
      expect(readPersistedEditorUiSettings()).toEqual(fullV1Snapshot);
    });

    it('persists JSON.stringify(snapshot) under the exported key (same bytes setItem would store)', () => {
      writePersistedEditorUiSettings(fullV1Snapshot);
      expect(globalThis.localStorage.getItem(EDITOR_UI_SETTINGS_STORAGE_KEY)).toBe(JSON.stringify(fullV1Snapshot));
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      localStorage.setItem(EDITOR_UI_SETTINGS_STORAGE_KEY, 'not-json{');
    });

    it('returns null from readPersistedEditorUiSettings when stored value is not valid JSON', () => {
      expect(readPersistedEditorUiSettings()).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null when the key is absent', () => {
      expect(localStorage.length).toBe(0);
      expect(readPersistedEditorUiSettings()).toBeNull();
    });

    it('returns null when version is not 1', () => {
      localStorage.setItem(
        EDITOR_UI_SETTINGS_STORAGE_KEY,
        JSON.stringify({ ...fullV1Snapshot, version: 99 }),
      );
      expect(readPersistedEditorUiSettings()).toBeNull();
    });

    it('round-trips showGuides false and staffSpacing default', () => {
      const snap = {
        version: 1 as const,
        entryMode: 'table' as const,
        labelMode: 'degree' as const,
        colorScheme: 'diatonic' as const,
        showGuides: false,
        staffSpacing: 'default' as const,
      };
      writePersistedEditorUiSettings(snap);
      expect(readPersistedEditorUiSettings()).toEqual(snap);
    });
  });
});
