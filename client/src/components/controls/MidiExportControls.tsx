import type { SongData } from '@vybpad/shared';
import { useCallback, useId, useState } from 'react';

import { midiExporter } from '@/engine/midi';

export type MidiExportMode = 'full' | 'melody';

/** Visible label + machine filename; avoids path characters (PAT-001 safe download names). */
export function buildMidiExportFilename(
  mode: MidiExportMode,
  song: SongData,
  projectName: string | null,
  activeVoice: number,
): string {
  const title = song.metadata.title?.trim() ?? '';
  const base =
    title.length > 0
      ? safeFileBaseName(title)
      : projectName && projectName.trim().length > 0
        ? safeFileBaseName(projectName.trim())
        : 'song';
  if (mode === 'full') {
    return `${base}-full.mid`;
  }
  const v = Math.min(3, Math.max(0, Math.floor(activeVoice)));
  return `${base}-melody-v${v + 1}.mid`;
}

function safeFileBaseName(raw: string, maxLen = 80): string {
  const s = raw
    .replace(/\s+/g, ' ')
    .replace(/[<>:"/\\|?*]/g, '')
    .trim()
    .slice(0, maxLen);
  return s || 'song';
}

function triggerBlobDownload(bytes: Uint8Array, filename: string): void {
  // Copy bytes so Blob always receives a plain Uint8Array (TS BlobPart + buffer-type compatibility).
  const blob = new Blob([Uint8Array.from(bytes)], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface MidiExportControlsProps {
  song: SongData;
  activeVoice: 0 | 1 | 2 | 3;
  projectName: string | null;
}

/**
 * TASK-6.4: Download current song as `.mid` using shared {@link midiExporter} only (no duplicate export logic).
 */
export function MidiExportControls({ song, activeVoice, projectName }: MidiExportControlsProps) {
  const [mode, setMode] = useState<MidiExportMode>('full');
  const selectId = useId();

  const onDownload = useCallback(() => {
    const bytes =
      mode === 'full'
        ? midiExporter.exportSong(song)
        : midiExporter.exportMelodyOnly(song, activeVoice);
    const name = buildMidiExportFilename(mode, song, projectName, activeVoice);
    triggerBlobDownload(bytes, name);
  }, [mode, song, activeVoice, projectName]);

  return (
    <div role="group" aria-label="MIDI export" className="flex flex-wrap items-center gap-2">
      <label
        htmlFor={selectId}
        className="text-sm font-medium text-[var(--color-text-secondary,#4B5563)]"
      >
        Export
      </label>
      <select
        id={selectId}
        value={mode}
        onChange={(e) => setMode(e.target.value as MidiExportMode)}
        className="h-10 min-h-11 min-w-[10rem] rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-2 text-sm text-[var(--color-text-primary,#111827)] outline-none focus:border-[var(--color-primary,#4F46E5)] focus:ring-1 focus:ring-[var(--color-primary,#4F46E5)]"
        aria-label="MIDI export format"
      >
        <option value="full">Full song (Type 1)</option>
        <option value="melody">Melody only</option>
      </select>
      <button
        type="button"
        data-testid="vybpad-midi-export-download"
        onClick={onDownload}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
      >
        Download .mid
      </button>
    </div>
  );
}
