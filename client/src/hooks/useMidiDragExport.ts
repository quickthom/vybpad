import type { SongData } from '@vybpad/shared';
import { useCallback, type DragEvent } from 'react';

import { createMidiExporter } from '../engine/midi';
import { useToastStore } from '../store/toastStore';

/** UX_GUIDELINES §373 — exact copy for MIDI drag-to-DAW feedback. */
export const MIDI_DRAG_TOAST_MESSAGE = 'Dragging MIDI…';

function midiFileName(song: SongData): string {
  const raw = song.metadata.title.trim() || 'export';
  const safe = raw.replace(/[^\w\s-]+/g, '').replace(/\s+/g, '-');
  return `${safe || 'export'}.mid`;
}

/**
 * Drag-and-drop MIDI export: populates `DataTransfer` with a file from `MidiExporter.createDragBlob`
 * and shows the §373 toast. Does not mutate song state.
 */
export function useMidiDragExport(song: SongData) {
  const showSuccess = useToastStore((s) => s.showSuccess);
  const dismiss = useToastStore((s) => s.dismiss);

  const handleDragStart = useCallback(
    (event: DragEvent) => {
      const dt = event.dataTransfer;
      if (!dt) return;

      const exporter = createMidiExporter();
      const blob = exporter.createDragBlob(song);
      const file = new File([blob], midiFileName(song), { type: blob.type });

      dt.effectAllowed = 'copy';
      try {
        dt.items.clear();
      } catch {
        // jsdom / partial DataTransfer mocks may omit clear()
      }
      dt.items.add(file);

      showSuccess(MIDI_DRAG_TOAST_MESSAGE);
    },
    [song, showSuccess],
  );

  const handleDragEnd = useCallback(() => {
    dismiss();
  }, [dismiss]);

  return { handleDragStart, handleDragEnd };
}
