import type { SongData } from '@vybpad/shared';

/**
 * INTERFACES.md — MIDI Export Interface (`MidiExporter`).
 * Builder (TASK-6.1) replaces the stub implementation.
 */
export interface MidiExporter {
  exportSong(song: SongData): Uint8Array;
  exportMelodyOnly(song: SongData, voice?: number): Uint8Array;
  createDragBlob(song: SongData): Blob;
}

/**
 * Returns a MIDI exporter instance. Stub returns empty / invalid bytes until TASK-6.1 is implemented.
 */
export function createMidiExporter(): MidiExporter {
  return {
    exportSong: () => new Uint8Array(0),
    exportMelodyOnly: () => new Uint8Array(0),
    createDragBlob: () => new Blob(),
  };
}
