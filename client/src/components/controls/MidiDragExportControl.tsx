import type { SongData } from '@vybpad/shared';

import { useMidiDragExport } from '@/hooks/useMidiDragExport';

export type MidiDragExportControlProps = {
  song: SongData;
  disabled?: boolean;
};

/**
 * Draggable control: drag the current song as a MIDI file into a desktop DAW (UX_GUIDELINES §373).
 */
export function MidiDragExportControl({ song, disabled }: MidiDragExportControlProps) {
  const { onDragStart, onDragEnd } = useMidiDragExport(song);

  return (
    <div className="flex flex-col gap-0.5" role="group" aria-label="MIDI file export">
      <button
        type="button"
        draggable={!disabled}
        disabled={disabled}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title="Drag into your DAW (e.g. Studio One)"
        aria-label="Drag MIDI file to desktop DAW"
        className="inline-flex min-h-11 min-w-11 cursor-copy items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        MIDI
      </button>
    </div>
  );
}
