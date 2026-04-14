import type { SongData } from '@vybpad/shared';
import { useCallback } from 'react';
import type { DragEvent } from 'react';

import { midiExporter } from '@/engine/midi';
import { useToastStore } from '@/store/toastStore';

const DRAG_TOAST = 'Dragging MIDI…';

/** Safe `.mid` filename from song title (Windows-forbidden chars stripped). */
export function midiFilenameForSong(song: SongData): string {
  const raw = (song.metadata.title || 'song').trim() || 'song';
  const safe = raw.replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) || 'song';
  return `${safe}.mid`;
}

/**
 * HTML5 drag-out using {@link midiExporter.createDragBlob} only (TASK-6.5 / INTERFACES § MidiExporter).
 * Toast + dismiss mirror UX_GUIDELINES §373 (copy cursor on control via `cursor-copy` class).
 */
export function useMidiDragExport(song: SongData) {
  const showSuccess = useToastStore((s) => s.showSuccess);
  const showError = useToastStore((s) => s.showError);
  const dismissToast = useToastStore((s) => s.dismiss);

  const onDragStart = useCallback(
    (e: DragEvent) => {
      // Authoritative MIME + contract: createDragBlob(song). Byte payload matches that blob (same as exportSong per midiExporter impl).
      const blob = midiExporter.createDragBlob(song);
      const name = midiFilenameForSong(song);
      const bytes = midiExporter.exportSong(song);
      const file = new File([new Uint8Array(bytes)], name, { type: blob.type || 'audio/midi' });
      e.dataTransfer.effectAllowed = 'copy';
      try {
        e.dataTransfer.items.add(file);
      } catch {
        e.preventDefault();
        showError('Could not start MIDI drag.');
        return;
      }
      showSuccess(DRAG_TOAST);
    },
    [song, showError, showSuccess],
  );

  const onDragEnd = useCallback(() => {
    dismissToast();
  }, [dismissToast]);

  return { onDragStart, onDragEnd };
}
