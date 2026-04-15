import { useMidiDragExport } from '../../hooks/useMidiDragExport';
import { useSongStore } from '../../store/songStore';

/**
 * Transport trailing control — drag MIDI into a desktop DAW (INTERFACES `MidiExporter.createDragBlob`).
 * UX §373: copy cursor + toast "Dragging MIDI…".
 */
export function MidiDragExportControl() {
  const song = useSongStore((s) => s.song);
  const { handleDragStart, handleDragEnd } = useMidiDragExport(song);

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      aria-label="Drag MIDI file to desktop DAW"
      className="inline-flex min-h-11 min-w-11 cursor-copy items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
    >
      MIDI
    </button>
  );
}
