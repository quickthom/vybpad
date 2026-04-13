import type { AudioEngine } from './audioEngineTypes';
import { createPlaybackEngine } from './createPlaybackEngine';

let engine: AudioEngine | null = null;

/** Shared playback engine — one graph per tab (idempotent factory). */
export function getPlaybackEngine(): AudioEngine {
  if (!engine) {
    engine = createPlaybackEngine();
  }
  return engine;
}

/**
 * Test-only: disposes the current engine so the next `getPlaybackEngine()` builds a fresh graph.
 * Not used in production code.
 */
export function resetPlaybackEngineForTests(): void {
  if (engine) {
    engine.dispose();
    engine = null;
  }
}
