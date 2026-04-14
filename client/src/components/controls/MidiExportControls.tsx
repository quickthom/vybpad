import type { SongData } from '@vybpad/shared';

/**
 * TASK-6.4 — MIDI export UI (format + download .mid).
 * QA stub: module resolves; Builder replaces with full implementation (see phase-6/export-ui).
 */
export interface MidiExportControlsProps {
  song: SongData;
  activeVoice: 0 | 1 | 2 | 3;
  projectName: string | null;
}

export function MidiExportControls(_props: MidiExportControlsProps) {
  return null;
}
