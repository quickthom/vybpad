/**
 * Mirrors INTERFACES.md `AudioEngine` (client-side contract).
 * @vybpad/shared does not export this interface yet — keep aligned with INTERFACES.md § Audio Engine Interface.
 */

import type { SongData, TrackRole } from '@vybpad/shared';

export interface AudioEngine {
  initialize(): Promise<void>;

  isReady(): boolean;

  loadSong(song: SongData): void;

  play(): void;
  pause(): void;
  stop(): void;
  seekTo(tick: number): void;

  setTempo(bpm: number): void;
  setLoop(enabled: boolean, startTick?: number, endTick?: number): void;

  setTrackVolume(role: TrackRole, volume: number): void;
  setTrackMute(role: TrackRole, mute: boolean): void;

  onTick(callback: (tick: number) => void): () => void;

  dispose(): void;
}
