/**
 * TASK-2.11 — Zustand `UIStore` contract tests (INTERFACES.md UIStore + TASK-2.11 acceptance criteria).
 * Uses only `useUIStore.getState()` / `useUIStore` public surface (no store internals).
 *
 * QA COVERAGE PLAN — TASK-2.11
 *
 * Criterion 1: Initial UIStore field values (brief + INTERFACES.md)
 *   happy: viewport, selection, activeVoice, entryMode, showGuides, colorScheme, activePanels match spec
 *   error: n/a (no error shapes for UI store)
 *   edges: activePanels is an empty Set (not a plain object)
 *
 * Criterion 2: setViewport full replacement (no partial merge)
 *   happy: second setViewport replaces entire viewport with the new Viewport object
 *   error: n/a
 *   edges: replacing after scroll/zoom change leaves no stale nested fields
 *
 * Criterion 3: setSelection
 *   happy: sets a Selection object; null clears selection
 *   error: n/a
 *   edges: round-trip null → value → null
 *
 * Criterion 4: setActiveVoice (0–3)
 *   happy: each allowed voice index is stored
 *   error: n/a
 *   edges: switching between boundary voices 0 and 3
 *
 * Criterion 5: togglePanel
 *   happy: first call adds panel id to activePanels; second call removes it
 *   error: n/a
 *   edges: toggle "band" specifically per AC
 *
 * Criterion 6: toggleEntryMode (wiring helper, not in INTERFACES.md)
 *   happy: alternates entryMode between "table" and "text"
 *   error: n/a
 *   edges: four toggles return to starting mode
 */
import type { Selection, Viewport } from '@vybpad/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUIStore } from '../../../src/store/uiStore';
import { useUIStore as useUIStoreFromBarrel } from '../../../src/store';

const DEFAULT_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};

/**
 * Reset fields that have INTERFACES setters. Does not call `togglePanel` (Immer MapSet / Set
 * semantics may require `enableMapSet()` — panel tests assume a fresh empty Set or prior cleanup).
 */
function baselineUIState(): void {
  const s = useUIStore.getState();
  s.setViewport({ ...DEFAULT_VIEWPORT });
  s.setSelection(null);
  s.setActiveVoice(0);
  while (useUIStore.getState().entryMode !== 'table') {
    useUIStore.getState().toggleEntryMode();
  }
}

describe('UIStore — TASK-2.11 / INTERFACES.md', () => {
  describe('public entrypoints', () => {
    it('exports the same useUIStore hook from client/src/store/index.ts as from uiStore.ts', () => {
      expect(useUIStoreFromBarrel).toBe(useUIStore);
    });
  });

  describe('initial state (Zustand create() defaults)', () => {
    it('exposes viewport { startMeasure: 0, measureCount: 8, scrollY: 0, zoom: 1 } on first getState()', () => {
      expect(useUIStore.getState().viewport).toEqual({
        startMeasure: 0,
        measureCount: 8,
        scrollY: 0,
        zoom: 1,
      });
    });

    it('exposes selection null on first getState()', () => {
      expect(useUIStore.getState().selection).toBeNull();
    });

    it('exposes activeVoice 0 on first getState()', () => {
      expect(useUIStore.getState().activeVoice).toBe(0);
    });

    it('exposes entryMode "table" on first getState()', () => {
      expect(useUIStore.getState().entryMode).toBe('table');
    });

    it('exposes showGuides false on first getState()', () => {
      expect(useUIStore.getState().showGuides).toBe(false);
    });

    it('exposes colorScheme "diatonic" on first getState()', () => {
      expect(useUIStore.getState().colorScheme).toBe('diatonic');
    });

    it('exposes activePanels as an empty Set on first getState()', () => {
      const { activePanels } = useUIStore.getState();
      expect(activePanels).toBeInstanceOf(Set);
      expect(activePanels.size).toBe(0);
    });
  });

  describe('setViewport — full replacement', () => {
    beforeEach(() => {
      baselineUIState();
    });

    it('replaces viewport entirely so the next getState().viewport equals the last Viewport passed (no merge with previous scrollY/zoom)', () => {
      useUIStore.getState().setViewport({
        startMeasure: 2,
        measureCount: 4,
        scrollY: 120,
        zoom: 1.25,
      });
      expect(useUIStore.getState().viewport).toEqual({
        startMeasure: 2,
        measureCount: 4,
        scrollY: 120,
        zoom: 1.25,
      });

      useUIStore.getState().setViewport({
        startMeasure: 0,
        measureCount: 16,
        scrollY: 0,
        zoom: 2,
      });
      expect(useUIStore.getState().viewport).toEqual({
        startMeasure: 0,
        measureCount: 16,
        scrollY: 0,
        zoom: 2,
      });
    });
  });

  describe('setSelection', () => {
    beforeEach(() => {
      baselineUIState();
    });

    it('sets selection to a chord Selection and can set it back to null', () => {
      const sel: Selection = {
        type: 'chord',
        measureIndex: 1,
        eventIds: ['a', 'b'],
      };
      useUIStore.getState().setSelection(sel);
      expect(useUIStore.getState().selection).toEqual(sel);

      useUIStore.getState().setSelection(null);
      expect(useUIStore.getState().selection).toBeNull();
    });
  });

  describe('setActiveVoice', () => {
    beforeEach(() => {
      baselineUIState();
    });

    it('sets activeVoice to 0, 1, 2, and 3 when each is passed to setActiveVoice', () => {
      useUIStore.getState().setActiveVoice(0);
      expect(useUIStore.getState().activeVoice).toBe(0);
      useUIStore.getState().setActiveVoice(1);
      expect(useUIStore.getState().activeVoice).toBe(1);
      useUIStore.getState().setActiveVoice(2);
      expect(useUIStore.getState().activeVoice).toBe(2);
      useUIStore.getState().setActiveVoice(3);
      expect(useUIStore.getState().activeVoice).toBe(3);
    });
  });

  describe('togglePanel', () => {
    beforeEach(() => {
      baselineUIState();
    });

    it('adds "band" to activePanels on first togglePanel("band") and removes it on the second call', () => {
      useUIStore.getState().togglePanel('band');
      expect(useUIStore.getState().activePanels.has('band')).toBe(true);
      expect(useUIStore.getState().activePanels.size).toBe(1);

      useUIStore.getState().togglePanel('band');
      expect(useUIStore.getState().activePanels.has('band')).toBe(false);
      expect(useUIStore.getState().activePanels.size).toBe(0);
    });
  });

  describe('toggleEntryMode', () => {
    beforeEach(() => {
      baselineUIState();
    });

    it('toggles entryMode from "table" to "text" then back to "table"', () => {
      expect(useUIStore.getState().entryMode).toBe('table');
      useUIStore.getState().toggleEntryMode();
      expect(useUIStore.getState().entryMode).toBe('text');
      useUIStore.getState().toggleEntryMode();
      expect(useUIStore.getState().entryMode).toBe('table');
    });

    it('returns to "table" after four consecutive toggleEntryMode calls starting from "table"', () => {
      expect(useUIStore.getState().entryMode).toBe('table');
      useUIStore.getState().toggleEntryMode();
      useUIStore.getState().toggleEntryMode();
      useUIStore.getState().toggleEntryMode();
      useUIStore.getState().toggleEntryMode();
      expect(useUIStore.getState().entryMode).toBe('table');
    });
  });
});
