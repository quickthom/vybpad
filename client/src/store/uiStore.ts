/**
 * Zustand UI shell state (TASK-2.11, TASK-7.6).
 *
 * Implements `UIStore` from INTERFACES.md (viewport, selection, panels, editor chrome, persistence).
 */

import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type { Selection, Viewport } from '@vybpad/shared';

import type { EditorLabelMode, StaffSpacing } from '../types/editorChrome';
import {
  readPersistedEditorUiSettings,
  writePersistedEditorUiSettings,
} from './editorUiSettingsPersistence';

/** Required for `activePanels: Set<string>` under zustand/middleware/immer. */
enableMapSet();

const DEFAULT_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};

const hydrated = typeof window !== 'undefined' ? readPersistedEditorUiSettings() : null;

/** Mirrors INTERFACES.md `UIStore`. */
export interface UIStore {
  viewport: Viewport;
  selection: Selection | null;
  activeVoice: 0 | 1 | 2 | 3;
  entryMode: 'table' | 'text';
  showGuides: boolean;
  colorScheme: 'diatonic' | 'major';
  labelMode: EditorLabelMode;
  staffSpacing: StaffSpacing;
  activePanels: Set<string>;

  setViewport: (v: Viewport) => void;
  setSelection: (s: Selection | null) => void;
  setActiveVoice: (v: 0 | 1 | 2 | 3) => void;
  setEntryMode: (mode: 'table' | 'text') => void;
  togglePanel: (panel: string) => void;
  /** Toggles `entryMode` between `"table"` and `"text"` (per INTERFACES.md). */
  toggleEntryMode: () => void;
  setShowGuides: (showGuides: boolean) => void;
  setColorScheme: (colorScheme: 'diatonic' | 'major') => void;
  setLabelMode: (mode: EditorLabelMode) => void;
  setStaffSpacing: (staffSpacing: StaffSpacing) => void;
}

export const useUIStore = create<UIStore>()(
  immer((set) => ({
    viewport: DEFAULT_VIEWPORT,
    selection: null,
    activeVoice: 0,
    entryMode: hydrated?.entryMode ?? 'table',
    showGuides: hydrated?.showGuides ?? false,
    colorScheme: hydrated?.colorScheme ?? 'diatonic',
    labelMode: hydrated?.labelMode ?? 'degree',
    staffSpacing: hydrated?.staffSpacing ?? 'default',
    activePanels: new Set<string>(),

    setViewport: (v: Viewport) => {
      set((draft) => {
        draft.viewport = v;
      });
    },

    setSelection: (s: Selection | null) => {
      set((draft) => {
        draft.selection = s;
      });
    },

    setActiveVoice: (v: 0 | 1 | 2 | 3) => {
      set((draft) => {
        draft.activeVoice = v;
      });
    },

    setEntryMode: (mode: 'table' | 'text') => {
      set((draft) => {
        draft.entryMode = mode;
      });
    },

    togglePanel: (panel: string) => {
      set((draft) => {
        if (draft.activePanels.has(panel)) {
          draft.activePanels.delete(panel);
        } else {
          draft.activePanels.add(panel);
        }
      });
    },

    toggleEntryMode: () => {
      set((draft) => {
        draft.entryMode = draft.entryMode === 'table' ? 'text' : 'table';
      });
    },

    setShowGuides: (showGuides: boolean) => {
      set((draft) => {
        draft.showGuides = showGuides;
      });
    },

    setColorScheme: (colorScheme: 'diatonic' | 'major') => {
      set((draft) => {
        draft.colorScheme = colorScheme;
      });
    },

    setLabelMode: (mode: EditorLabelMode) => {
      set((draft) => {
        draft.labelMode = mode;
      });
    },

    setStaffSpacing: (staffSpacing: StaffSpacing) => {
      set((draft) => {
        draft.staffSpacing = staffSpacing;
      });
    },
  })),
);

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (persistTimer != null) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const s = useUIStore.getState();
    writePersistedEditorUiSettings({
      version: 1,
      entryMode: s.entryMode,
      labelMode: s.labelMode,
      colorScheme: s.colorScheme,
      showGuides: s.showGuides,
      staffSpacing: s.staffSpacing,
    });
  }, 50);
}

if (typeof window !== 'undefined') {
  useUIStore.subscribe((state, prev) => {
    if (
      state.entryMode === prev.entryMode &&
      state.labelMode === prev.labelMode &&
      state.colorScheme === prev.colorScheme &&
      state.showGuides === prev.showGuides &&
      state.staffSpacing === prev.staffSpacing
    ) {
      return;
    }
    schedulePersist();
  });
}
