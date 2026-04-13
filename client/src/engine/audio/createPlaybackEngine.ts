import type { SongData, TrackRole } from '@vybpad/shared';
import { TICKS_PER_QUARTER } from '@vybpad/shared';
import * as Tone from 'tone';

import { useToastStore } from '../../store/toastStore';
import type { AudioEngine } from './audioEngineTypes';
import {
  getPlaybackErrorMessage,
  PLAYBACK_ERROR_CODES,
  PlaybackError,
  playbackError,
} from './playbackErrors';

const TPQN = TICKS_PER_QUARTER;

/**
 * Creates the Tone.js-backed playback engine. The module imports Tone.js (no `AudioContext.resume`
 * until {@link AudioEngine.initialize} calls `Tone.start()` after a user gesture).
 */
export function createPlaybackEngine(): AudioEngine {
  /** Single in-flight init; repeated callers await the same promise (idempotent success path). */
  let initPromise: Promise<void> | null = null;
  let ready = false;

  let songRef: SongData | null = null;
  let playing = false;
  let rafId: number | null = null;

  const tickListeners = new Set<(tick: number) => void>();

  function notifyTicks(tick: number): void {
    for (const fn of tickListeners) {
      fn(tick);
    }
  }

  function stopCursorLoop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function runCursorLoop(): void {
    if (!playing || !ready) return;
    const tick = Tone.getTransport().ticks;
    notifyTicks(tick);
    rafId = requestAnimationFrame(runCursorLoop);
  }

  return {
    async initialize(): Promise<void> {
      if (ready) {
        return;
      }
      if (initPromise) {
        await initPromise;
        return;
      }

      initPromise = (async () => {
        try {
          await Tone.start();
        } catch {
          const msg = getPlaybackErrorMessage(playbackError(PLAYBACK_ERROR_CODES.AUDIO_INIT_FAILED));
          useToastStore.getState().showError(msg);
          throw new PlaybackError(PLAYBACK_ERROR_CODES.AUDIO_INIT_FAILED);
        }

        const transport = Tone.getTransport();
        transport.PPQ = TPQN;

        // INTERFACES: initialize() loads context + piano samples. Sample buffers attach in a later
        // scheduling task; transport PPQ matches shared TPQN (48) for tick-aligned UI.
        ready = true;
      })();

      try {
        await initPromise;
      } catch (err) {
        initPromise = null;
        ready = false;
        if (err instanceof PlaybackError) {
          throw err;
        }
        const fallback = new PlaybackError(PLAYBACK_ERROR_CODES.AUDIO_INIT_FAILED);
        useToastStore.getState().showError(getPlaybackErrorMessage(fallback));
        throw fallback;
      }
    },

    isReady(): boolean {
      return ready;
    },

    loadSong(song: SongData): void {
      songRef = song;
      if (!ready) {
        return;
      }
      Tone.getTransport().bpm.value = song.metadata.tempo;
    },

    play(): void {
      if (!ready) {
        return;
      }
      if (songRef) {
        Tone.getTransport().bpm.value = songRef.metadata.tempo;
      }
      playing = true;
      Tone.getTransport().start();
      stopCursorLoop();
      runCursorLoop();
    },

    pause(): void {
      if (!ready) {
        return;
      }
      playing = false;
      stopCursorLoop();
      Tone.getTransport().pause();
    },

    stop(): void {
      if (!ready) {
        return;
      }
      playing = false;
      stopCursorLoop();
      const transport = Tone.getTransport();
      transport.stop();
      transport.ticks = 0;
      notifyTicks(0);
    },

    seekTo(tick: number): void {
      if (!ready) {
        return;
      }
      const clamped = Math.max(0, tick);
      Tone.getTransport().ticks = clamped;
      notifyTicks(clamped);
    },

    setTempo(bpm: number): void {
      if (!ready) {
        return;
      }
      Tone.getTransport().bpm.value = bpm;
    },

    setLoop(enabled: boolean, startTick?: number, endTick?: number): void {
      if (!ready) {
        return;
      }
      const transport = Tone.getTransport();
      transport.loop = enabled;
      if (startTick !== undefined) {
        transport.loopStart = startTick;
      }
      if (endTick !== undefined) {
        transport.loopEnd = endTick;
      }
    },

    setTrackVolume(role: TrackRole, volume: number): void {
      void role;
      void volume;
      /* Instrument graph — scheduled with TASK scheduling work */
    },

    setTrackMute(role: TrackRole, mute: boolean): void {
      void role;
      void mute;
      /* Instrument graph — scheduled with TASK scheduling work */
    },

    onTick(callback: (tick: number) => void): () => void {
      tickListeners.add(callback);
      return () => {
        tickListeners.delete(callback);
      };
    },

    dispose(): void {
      stopCursorLoop();
      playing = false;
      tickListeners.clear();
      ready = false;
      initPromise = null;
      try {
        Tone.getTransport().stop();
        Tone.getTransport().cancel();
      } catch {
        /* dispose is best-effort */
      }
      songRef = null;
    },
  };
}
