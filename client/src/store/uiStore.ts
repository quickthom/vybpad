/**
 * Zustand UI shell state (TASK-2.11).
 *
 * Implements `UIStore` from INTERFACES.md (viewport, selection, panels, `toggleEntryMode`, etc.).
 */

import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type { Selection, Viewport } from '@vybpad/shared';

/** Required for `activePanels: Set<string>` under zustand/middleware/immer. */
enableMapSet();

const DEFAULT_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};

/** Mirrors INTERFACES.md `UIStore`. */
export interface UIStore {
  viewport: Viewport;
  selection: Selection | null;
  activeVoice: 0 | 1 | 2 | 3;
  entryMode: 'table' | 'text';
  showGuides: boolean;
  colorScheme: 'diatonic' | 'major';
  activePanels: Set<string>;

  setViewport: (v: Viewport) => void;
  setSelection: (s: Selection | null) => void;
  setActiveVoice: (v: 0 | 1 | 2 | 3) => void;
  togglePanel: (panel: string) => void;
  /** Toggles `entryMode` between `"table"` and `"text"` (per INTERFACES.md). */
  toggleEntryMode: () => void;
}

export const useUIStore = create<UIStore>()(
  immer((set) => ({
    viewport: DEFAULT_VIEWPORT,
    selection: null,
    activeVoice: 0 as 0 | 1 | 2 | 3,
    entryMode: 'table' as const,
    showGuides: false,
    colorScheme: 'diatonic' as const,
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
  })),
);
