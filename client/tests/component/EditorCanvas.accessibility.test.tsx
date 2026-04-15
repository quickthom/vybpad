/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — F08.2-QA
 *
 * Criterion 1: EditorCanvas exposes chord shortcut discoverability (d, i, e) in its accessible name
 *   happy: aria-label includes each shortcut letter as a token (standalone word / key), per D-12 / MILESTONE-F08
 *   error: N/A (static DOM contract)
 *   edges: N/A
 *
 * Criterion 2: Canvas remains in the tab order for keyboard users (§9)
 *   happy: tabIndex is 0 on the application canvas
 *   error: N/A
 *   edges: N/A
 */

import type { Viewport } from '@vybpad/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { buildDefaultSong } from '@/store/songStore';

const DEFAULT_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};

function stubCanvas2d(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId) => {
    if (contextId !== '2d') {
      return null;
    }
    return {
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      clip: vi.fn(),
      translate: vi.fn(),
      setTransform: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      arcTo: vi.fn(),
      roundRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  });
}

function mockCanvasLayout(rect: Partial<DOMRect> & Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): void {
  const full: DOMRect = {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    left: rect.left,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON() {
      return {};
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(full);
}

describe('EditorCanvas — accessibility (F08.2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubCanvas2d();
  });

  afterEach(() => {
    cleanup();
  });

  describe('happy path', () => {
    it('sets tabIndex 0 on the application canvas', () => {
      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
      render(
        <EditorCanvas
          song={buildDefaultSong()}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = screen.getByRole('application');
      expect(canvas.tabIndex).toBe(0);
    });

    it('includes standalone shortcut letters d, i, and e in aria-label (chord discoverability)', () => {
      mockCanvasLayout({ left: 0, top: 0, width: 800, height: 600 });
      render(
        <EditorCanvas
          song={buildDefaultSong()}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const label = screen.getByRole('application').getAttribute('aria-label') ?? '';
      // Word boundaries: require each key as its own token (not substrings like "digits" or "editor").
      expect(label).toMatch(/\bd\b/);
      expect(label).toMatch(/\bi\b/);
      expect(label).toMatch(/\be\b/);
    });
  });
});
