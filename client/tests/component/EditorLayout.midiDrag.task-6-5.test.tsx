/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — TASK-6.5 (MIDI drag-and-drop export)
 *
 * Criterion 1: Drag exposes blob from MidiExporter.createDragBlob / correct types (INTERFACES § MidiExporter)
 *   happy: dragstart populates DataTransfer with a file whose bytes and MIME match createDragBlob(song)
 *   error: N/A (export always produces bytes)
 *   edges: N/A beyond contract parity
 *
 * Criterion 2: Feedback per UX §5.10 / drag affordances (UX_GUIDELINES §370–373) where testable
 *   happy: copy cursor (cursor-copy) on MIDI drag affordance; toast "Dragging MIDI…"; non-error toast uses polite live region
 *   error: N/A
 *   edges: N/A
 *
 * Criterion 3: No regression to song store or unrelated editor behavior
 *   happy: song document unchanged after dragstart/dragend sequence
 *   happy: unrelated header control (e.g. Chords toggle) still responds after drag sequence
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorLayout } from '@/app/EditorLayout';
import { ToastHost } from '@/components/common/ToastHost';
import { createMidiExporter } from '@/engine/midi';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useToastStore } from '@/store/toastStore';
import { resetPlaybackStoreForTests } from '@/store/playbackStore';

/** Minimal Canvas 2D mock so `EditorCanvas` mounts under jsdom. */
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

/** UX_GUIDELINES §373 — exact toast copy for MIDI drag export. */
const DRAGGING_MIDI_TOAST = 'Dragging MIDI…';

/**
 * Stable accessible name for the MIDI drag affordance (toolbar).
 * Builder: expose a focusable control with this exact name (e.g. aria-label on draggable button).
 */
const MIDI_DRAG_NAME = 'Drag MIDI to DAW';

function renderEditorWithToast(): ReturnType<typeof render> {
  return render(
    <BrowserRouter>
      <EditorLayout />
      <ToastHost />
    </BrowserRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetPlaybackStoreForTests();
  useToastStore.getState().dismiss();
});

describe('TASK-6.5 — MIDI drag export (INTERFACES § MidiExporter.createDragBlob)', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
  });

  describe('happy path', () => {
    it('on dragstart, DataTransfer exposes a MIDI file whose bytes match createMidiExporter().createDragBlob(song) and audio/midi type', async () => {
      renderEditorWithToast();
      const song = useSongStore.getState().song;
      const exporter = createMidiExporter();
      const expectedBytes = exporter.exportSong(song);
      const expectedMime = exporter.createDragBlob(song).type.toLowerCase();

      const dragControl = screen.getByRole('button', { name: MIDI_DRAG_NAME });
      const dt = new DataTransfer();
      fireEvent.dragStart(dragControl, { dataTransfer: dt });

      expect(dt.effectAllowed === 'copy' || dt.effectAllowed === 'all' || dt.effectAllowed === 'copyMove').toBe(
        true,
      );

      expect(dt.files.length).toBeGreaterThanOrEqual(1);
      const file = dt.files.item(0);
      expect(file).toBeTruthy();
      expect(file!.type.toLowerCase()).toBe(expectedMime);

      const got = new Uint8Array(await file!.arrayBuffer());
      expect(got).toEqual(expectedBytes);
      expect(expectedMime).toMatch(/midi/);
    });
  });
});

describe('TASK-6.5 — UX §370–373 drag feedback (cursor, toast, live region)', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
  });

  describe('happy path', () => {
    it('MIDI drag affordance uses copy cursor (Tailwind cursor-copy) per UX §373', () => {
      renderEditorWithToast();
      const dragControl = screen.getByRole('button', { name: MIDI_DRAG_NAME });
      expect(dragControl.className).toMatch(/cursor-copy/);
    });

    it('shows toast "Dragging MIDI…" on dragstart using polite live region (role=status, aria-live=polite)', () => {
      renderEditorWithToast();
      const dragControl = screen.getByRole('button', { name: MIDI_DRAG_NAME });
      fireEvent.dragStart(dragControl, { dataTransfer: new DataTransfer() });

      const toast = screen.getByRole('status');
      expect(toast).toHaveAttribute('aria-live', 'polite');
      expect(within(toast).getByText(DRAGGING_MIDI_TOAST)).toBeTruthy();
    });
  });
});

describe('TASK-6.5 — no regression to song store or unrelated editor chrome', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
  });

  describe('happy path', () => {
    it('does not mutate song data when MIDI drag starts and ends', () => {
      renderEditorWithToast();
      const before = JSON.stringify(useSongStore.getState().song);

      const dragControl = screen.getByRole('button', { name: MIDI_DRAG_NAME });
      const dt = new DataTransfer();
      fireEvent.dragStart(dragControl, { dataTransfer: dt });
      fireEvent.dragEnd(dragControl, { dataTransfer: dt });

      const after = JSON.stringify(useSongStore.getState().song);
      expect(after).toBe(before);
    });

    it('MeasureBar Add still increases measure count after MIDI drag sequence', () => {
      renderEditorWithToast();
      const dragControl = screen.getByRole('button', { name: MIDI_DRAG_NAME });
      const dt = new DataTransfer();
      fireEvent.dragStart(dragControl, { dataTransfer: dt });
      fireEvent.dragEnd(dragControl, { dataTransfer: dt });

      const before = useSongStore.getState().song.measures.length;
      const regions = screen.getAllByRole('region', { name: 'Measures' });
      const strip = regions[regions.length - 1]!;
      fireEvent.click(within(strip).getByRole('button', { name: /^add$/i }));
      expect(useSongStore.getState().song.measures.length).toBe(before + 1);
    });
  });
});
