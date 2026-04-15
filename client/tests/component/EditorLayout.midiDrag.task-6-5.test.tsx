/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — F09.1 (MIDI export polish: info toast + ARIA + preserved export)
 *
 * Criterion 1: MIDI drag-start feedback uses info toast path, not success; live region polite and non-blocking
 *   happy: dragstart shows "Dragging MIDI…" with variant info, role=status, aria-live=polite, info border accent
 *   error: N/A
 *   edges: assert not success accent / not assertive live region for this feedback
 *
 * Criterion 2: MIDI export cluster does not expose redundant nested ARIA groups for the same visual region (UX §5.8)
 *   happy: trailing transport export slot exposes at most one role=group for the cluster (no Export wrapper + inner MIDI export group)
 *   error: N/A
 *   edges: N/A
 *
 * Criterion 3: Download/export and drag payload behavior preserved (INTERFACES MidiExporter)
 *   happy: dragstart file bytes match exporter; Download .mid yields same bytes as exportSong in full mode; song unchanged after drag
 *   error: N/A
 *   edges: copy cursor on drag affordance; MeasureBar Add still works after drag sequence
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorLayout } from '@/app/EditorLayout';
import { ToastHost } from '@/components/common/ToastHost';
import { createMidiExporter, midiExporter } from '@/engine/midi';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { resetToastDedupeForTests, useToastStore } from '@/store/toastStore';
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

/** UX_GUIDELINES §8 / §373 — exact toast copy for MIDI drag-to-DAW feedback. */
const DRAGGING_MIDI_TOAST = 'Dragging MIDI…';

/**
 * Matches `MidiDragExportControl` aria-label (toolbar / transport — TASK-6.5).
 */
const MIDI_DRAG_NAME = /drag midi file to desktop daw/i;

/**
 * jsdom does not expose `DataTransfer` globally; `useMidiDragExport` only needs `effectAllowed`,
 * `items.add`, and readable `files` after add (see Builder `midiDragExport.task-6-5.test.tsx`).
 */
async function uint8FromFile(f: File): Promise<Uint8Array> {
  const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(f);
  });
  return new Uint8Array(buf);
}

function createStubDataTransfer(): {
  dataTransfer: {
    effectAllowed: string;
    files: FileList;
    items: { add: (f: File) => void; clear?: () => void };
  };
  getFiles: () => File[];
} {
  const bucket: File[] = [];
  const list = {
    length: 0,
    item: (index: number) => bucket[index] ?? null,
    [Symbol.iterator]: function* fileIterator() {
      for (const f of bucket) yield f;
    },
  } as FileList;
  return {
    getFiles: () => [...bucket],
    dataTransfer: {
      effectAllowed: 'uninitialized',
      get files(): FileList {
        list.length = bucket.length;
        return list;
      },
      items: {
        add: (f: File) => {
          bucket.push(f);
        },
        clear: () => {
          bucket.length = 0;
        },
      },
    },
  };
}

function renderEditorWithToast(): ReturnType<typeof render> {
  return render(
    <BrowserRouter>
      <EditorLayout />
      <ToastHost />
    </BrowserRouter>,
  );
}

/** jsdom Blob may omit or partially implement `arrayBuffer()`; FileReader is reliable (MidiExportControls.task-6-4). */
async function blobToUint8(b: Blob): Promise<Uint8Array> {
  if (typeof b.arrayBuffer === 'function') {
    try {
      return new Uint8Array(await b.arrayBuffer());
    } catch {
      /* fall through */
    }
  }
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(b);
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetPlaybackStoreForTests();
  useToastStore.getState().dismiss();
});

describe('F09.1 — MIDI drag-start uses info toast path (UX §5.7)', () => {
  beforeEach(() => {
    stubCanvas2d();
    resetToastDedupeForTests();
    useSongStore.getState().loadSong(buildDefaultSong());
  });

  describe('happy path', () => {
    it('announces MIDI drag-start with info variant, polite status live region, and info accent (not success)', async () => {
      renderEditorWithToast();
      const dragControl = screen.getByRole('button', { name: MIDI_DRAG_NAME });
      const { dataTransfer: dt } = createStubDataTransfer();
      fireEvent.dragStart(dragControl, { dataTransfer: dt as unknown as DataTransfer });

      await waitFor(() => {
        expect(useToastStore.getState().message).toBe(DRAGGING_MIDI_TOAST);
      });

      expect(useToastStore.getState().variant as string).toBe('info');

      const toast = screen.getByText(DRAGGING_MIDI_TOAST).closest('[role="status"]');
      expect(toast).toBeTruthy();
      expect(toast).toHaveAttribute('aria-live', 'polite');
      expect(toast?.className).toMatch(/color-info/);
      expect(toast?.className).not.toMatch(/color-success/);
    });
  });
});

describe('F09.1 — MIDI export cluster ARIA (UX §5.8)', () => {
  beforeEach(() => {
    stubCanvas2d();
    resetToastDedupeForTests();
    useSongStore.getState().loadSong(buildDefaultSong());
  });

  describe('happy path', () => {
    it('does not nest multiple role=group regions for the trailing MIDI export cluster', () => {
      renderEditorWithToast();
      const toolbar = screen.getByTestId('vybpad-transport-toolbar');
      const exportCluster = toolbar.querySelector('[aria-label="Export"]');
      expect(exportCluster).toBeTruthy();

      const root = exportCluster as HTMLElement;
      const selfIsGroup = root.getAttribute('role') === 'group' ? 1 : 0;
      const descendantGroups = root.querySelectorAll('[role="group"]').length;
      expect(selfIsGroup + descendantGroups).toBe(1);
    });
  });
});

describe('F09.1 — preserved MIDI download and drag payload (INTERFACES MidiExporter)', () => {
  beforeEach(() => {
    stubCanvas2d();
    resetToastDedupeForTests();
    useSongStore.getState().loadSong(buildDefaultSong());
  });

  describe('happy path', () => {
    it('on dragstart, DataTransfer exposes a MIDI file whose bytes match createMidiExporter().exportSong(song) and audio/midi type', async () => {
      renderEditorWithToast();
      const song = useSongStore.getState().song;
      const exporter = createMidiExporter();
      const expectedBytes = exporter.exportSong(song);
      const expectedMime = exporter.createDragBlob(song).type.toLowerCase();

      const dragControl = screen.getByRole('button', { name: MIDI_DRAG_NAME });
      const { dataTransfer: dt, getFiles } = createStubDataTransfer();
      fireEvent.dragStart(dragControl, { dataTransfer: dt as unknown as DataTransfer });

      expect(dt.effectAllowed === 'copy' || dt.effectAllowed === 'all' || dt.effectAllowed === 'copyMove').toBe(
        true,
      );

      const files = getFiles();
      expect(files.length).toBeGreaterThanOrEqual(1);
      const file = files[0]!;
      expect(file).toBeTruthy();
      expect(file!.type.toLowerCase()).toBe(expectedMime);

      const got = await uint8FromFile(file!);
      expect(got).toEqual(expectedBytes);
      expect(expectedMime).toMatch(/midi/);
    });

    it('MIDI drag affordance uses copy cursor (Tailwind cursor-copy) per UX §8', () => {
      renderEditorWithToast();
      const dragControl = screen.getByRole('button', { name: MIDI_DRAG_NAME });
      expect(dragControl.className).toMatch(/cursor-copy/);
    });

    it('Download .mid passes the same bytes to URL.createObjectURL as midiExporter.exportSong for full-song mode', async () => {
      renderEditorWithToast();
      const song = useSongStore.getState().song;
      const blobsFromDownload: Blob[] = [];
      vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob) => {
        blobsFromDownload.push(b);
        return `blob:mock-${blobsFromDownload.length}`;
      });
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const exportSongSpy = vi.spyOn(midiExporter, 'exportSong');

      fireEvent.click(screen.getByTestId('vybpad-midi-export-download'));

      expect(exportSongSpy).toHaveBeenCalled();
      const bytesFromExport = exportSongSpy.mock.results[0]?.value as Uint8Array;
      const blob = blobsFromDownload.at(-1) as Blob;
      expect(blob.type.toLowerCase()).toMatch(/midi/);
      expect(await blobToUint8(blob)).toEqual(bytesFromExport);
    });

    it('does not mutate song data when MIDI drag starts and ends', () => {
      renderEditorWithToast();
      const before = JSON.stringify(useSongStore.getState().song);

      const dragControl = screen.getByRole('button', { name: MIDI_DRAG_NAME });
      const { dataTransfer: dt } = createStubDataTransfer();
      fireEvent.dragStart(dragControl, { dataTransfer: dt as unknown as DataTransfer });
      fireEvent.dragEnd(dragControl, { dataTransfer: dt as unknown as DataTransfer });

      const after = JSON.stringify(useSongStore.getState().song);
      expect(after).toBe(before);
    });

    it('MeasureBar Add still increases measure count after MIDI drag sequence', () => {
      renderEditorWithToast();
      const dragControl = screen.getByRole('button', { name: MIDI_DRAG_NAME });
      const { dataTransfer: dt } = createStubDataTransfer();
      fireEvent.dragStart(dragControl, { dataTransfer: dt as unknown as DataTransfer });
      fireEvent.dragEnd(dragControl, { dataTransfer: dt as unknown as DataTransfer });

      const before = useSongStore.getState().song.measures.length;
      const regions = screen.getAllByRole('region', { name: 'Measures' });
      const strip = regions[regions.length - 1]!;
      fireEvent.click(within(strip).getByRole('button', { name: /^add$/i }));
      expect(useSongStore.getState().song.measures.length).toBe(before + 1);
    });
  });
});
