/**
 * Lazy-loads SplendidGrandPiano (smplr) on first playback init, using the Tone.js
 * underlying AudioContext. Samples are cached across sessions via smplr {@link CacheStorage}
 * (Cache API) per ARCHITECTURE.md.
 */

import { CacheStorage, SplendidGrandPiano } from 'smplr';
import * as Tone from 'tone';

import {
  PLAYBACK_ERROR_CODES,
  playbackError,
} from './playbackErrors';

let piano: SplendidGrandPiano | null = null;
/** Single in-flight load; success leaves a resolved promise (dedupes parallel awaits). */
let loadPromise: Promise<void> | null = null;

function getNativeAudioContext(): AudioContext {
  return Tone.getContext().rawContext as AudioContext;
}

/**
 * Ensures piano SoundFont samples are decoded and ready. Safe to call repeatedly;
 * subsequent calls resolve immediately without re-fetching buffers.
 */
export async function ensurePianoSamplesLoaded(): Promise<void> {
  if (piano) {
    return;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const ctx = getNativeAudioContext();
        const instrument = new SplendidGrandPiano(ctx, {
          storage: new CacheStorage('vybpad-piano-samples'),
        });
        piano = await instrument.load;
      } catch (err) {
        // Allow a later retry after a failed fetch / decode.
        loadPromise = null;
        // PAT-006: surfaced to DevTools; user copy comes from getPlaybackInitErrorMessage.
        console.error(err);
        throw playbackError(PLAYBACK_ERROR_CODES.SAMPLE_LOAD_FAILED);
      }
    })();
  }
  await loadPromise;
}

/** Stops the instrument and clears module cache (engine dispose + tests). */
export function disposePianoSamples(): void {
  try {
    piano?.disconnect();
  } catch {
    /* best-effort */
  }
  piano = null;
  loadPromise = null;
}

/** Test alias — same as {@link disposePianoSamples}. */
export const resetPianoSampleCacheForTests = disposePianoSamples;

export function getPianoInstrument(): SplendidGrandPiano | null {
  return piano;
}
