/**
 * Zustand `PlaybackStore` per INTERFACES.md (init lifecycle + transport).
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import {
  getPlaybackEngine,
  getPlaybackInitErrorCode,
  setPlaybackMelodyVoiceVisibleForScheduling,
  setPlaybackMetronomePreference,
  takeMetronomeLastPlayResult,
  type PlaybackInitErrorCode,
  type PlaybackInitStatus,
} from '../engine/audio';
import { useToastStore } from './toastStore';
import { useSongStore } from './songStore';
import { useUIStore } from './uiStore';

export type { PlaybackInitErrorCode, PlaybackInitStatus };

/** INTERFACES.md `PlaybackStore` — client implementation. */
export interface PlaybackStore {
  isPlaying: boolean;
  currentTick: number | null;
  isLooping: boolean;
  loopStart: number;
  loopEnd: number;

  initStatus: PlaybackInitStatus;
  initErrorCode: PlaybackInitErrorCode | null;
  /** UI-W8 — audible metronome when the engine can schedule a click. */
  metronomeEnabled: boolean;
  /** UI-W8 — record arm only; disk capture is not implemented yet. */
  recordArmed: boolean;

  initializeAudio: () => Promise<void>;
  clearInitError: () => void;

  play: () => void;
  pause: () => void;
  stop: () => void;
  rewind: () => void;
  seekTo: (tick: number) => void;
  setLoop: (start: number, end: number) => void;
  /** Disables loop playback and clears engine loop mode. INTERFACES.md update pending (TASK-4.8). */
  clearLoop: () => void;
  setMetronomeEnabled: (enabled: boolean) => void;
  setRecordArmed: (armed: boolean) => void;
}

let initChain: Promise<void> | null = null;
let tickUnsub: (() => void) | null = null;

function ensureTickSubscription(set: (fn: (draft: PlaybackStore) => void) => void): void {
  if (tickUnsub) {
    return;
  }
  const engine = getPlaybackEngine();
  tickUnsub = engine.onTick((tick) => {
    set((draft) => {
      draft.currentTick = tick;
    });
  });
}

function syncEngineFromSong(): void {
  const engine = getPlaybackEngine();
  if (!engine.isReady()) {
    return;
  }
  setPlaybackMelodyVoiceVisibleForScheduling(useUIStore.getState().melodyVoiceVisible);
  engine.loadSong(useSongStore.getState().song);
}

/** PAT-004: loop bounds are integer ticks; musically invalid ranges are rejected (store unchanged). */
function isValidLoopRange(start: number, end: number): boolean {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return false;
  }
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return false;
  }
  return end > start;
}

export const usePlaybackStore = create<PlaybackStore>()(
  immer((set, get) => ({
    isPlaying: false,
    currentTick: null,
    isLooping: false,
    loopStart: 0,
    loopEnd: 0,

    initStatus: 'locked',
    initErrorCode: null,
    metronomeEnabled: false,
    recordArmed: false,

    clearInitError: () => {
      set((draft) => {
        draft.initErrorCode = null;
        if (draft.initStatus === 'error') {
          draft.initStatus = 'locked';
        }
      });
    },

    initializeAudio: async () => {
      if (getPlaybackEngine().isReady()) {
        set((draft) => {
          draft.initStatus = 'ready';
          draft.initErrorCode = null;
        });
        ensureTickSubscription(set);
        syncEngineFromSong();
        return;
      }
      if (get().initStatus === 'ready') {
        return;
      }
      // Sync so TransportControls can derive loading UI from `initStatus` only (no parent isBootstrapping).
      set((draft) => {
        draft.initStatus = 'initializing';
        draft.initErrorCode = null;
      });
      if (!initChain) {
        initChain = (async () => {
          try {
            const engine = getPlaybackEngine();
            await engine.initialize();
            ensureTickSubscription(set);
            // Let React commit `initializing` before sync loadSong (voicing dry-run can block the main thread on large scores).
            await new Promise<void>((resolve) => {
              queueMicrotask(resolve);
            });
            syncEngineFromSong();
            set((draft) => {
              draft.initStatus = 'ready';
            });
          } catch (err) {
            const code = getPlaybackInitErrorCode(err);
            set((draft) => {
              draft.initStatus = 'error';
              draft.initErrorCode = code;
            });
          } finally {
            initChain = null;
          }
        })();
      }
      await initChain;
      // Defensive: if the engine finished but the store did not advance (e.g. interrupted batching), recover.
      if (getPlaybackEngine().isReady() && get().initStatus === 'initializing') {
        ensureTickSubscription(set);
        syncEngineFromSong();
        set((draft) => {
          draft.initStatus = 'ready';
          draft.initErrorCode = null;
        });
      }
    },

    play: () => {
      if (!getPlaybackEngine().isReady()) {
        return;
      }
      const engine = getPlaybackEngine();
      syncEngineFromSong();
      const { isLooping, loopStart, loopEnd, recordArmed, metronomeEnabled } = get();
      engine.setLoop(isLooping, loopStart, loopEnd);
      engine.play();
      if (recordArmed) {
        useToastStore.getState().showInfo('Recording to disk is not available yet.');
      }
      if (metronomeEnabled) {
        const metro = takeMetronomeLastPlayResult();
        if (metro === 'fail') {
          useToastStore
            .getState()
            .showInfo('Metronome click is not available in this environment; toggle stays on for when it is.');
        }
      }
      set((draft) => {
        draft.isPlaying = true;
        if (draft.currentTick === null) {
          draft.currentTick = 0;
        }
      });
    },

    pause: () => {
      if (!getPlaybackEngine().isReady()) {
        return;
      }
      getPlaybackEngine().pause();
      set((draft) => {
        draft.isPlaying = false;
      });
    },

    stop: () => {
      if (!getPlaybackEngine().isReady()) {
        return;
      }
      getPlaybackEngine().stop();
      set((draft) => {
        draft.isPlaying = false;
        draft.currentTick = null;
      });
    },

    rewind: () => {
      get().seekTo(0);
    },

    seekTo: (tick: number) => {
      if (!getPlaybackEngine().isReady()) {
        return;
      }
      const clamped = Math.max(0, tick);
      getPlaybackEngine().seekTo(clamped);
      set((draft) => {
        draft.currentTick = clamped;
      });
    },

    setLoop: (start: number, end: number) => {
      if (!isValidLoopRange(start, end)) {
        return;
      }
      set((draft) => {
        draft.isLooping = true;
        draft.loopStart = start;
        draft.loopEnd = end;
      });
      if (getPlaybackEngine().isReady()) {
        getPlaybackEngine().setLoop(true, start, end);
      }
    },

    clearLoop: () => {
      set((draft) => {
        draft.isLooping = false;
      });
      if (getPlaybackEngine().isReady()) {
        getPlaybackEngine().setLoop(false);
      }
    },

    setMetronomeEnabled: (enabled: boolean) => {
      set((draft) => {
        draft.metronomeEnabled = enabled;
      });
      setPlaybackMetronomePreference(enabled);
    },

    setRecordArmed: (armed: boolean) => {
      set((draft) => {
        draft.recordArmed = armed;
      });
    },
  })),
);

/** Called when the song document changes so transport tempo / length stay aligned (TASK-4.1). */
export function syncPlaybackEngineWithSong(): void {
  syncEngineFromSong();
}

/** Vitest-only: clears tick subscription + store state without touching the real AudioContext. */
export function resetPlaybackStoreForTests(): void {
  tickUnsub?.();
  tickUnsub = null;
  initChain = null;
  usePlaybackStore.setState({
    isPlaying: false,
    currentTick: null,
    isLooping: false,
    loopStart: 0,
    loopEnd: 0,
    initStatus: 'locked',
    initErrorCode: null,
    metronomeEnabled: false,
    recordArmed: false,
  });
  setPlaybackMetronomePreference(false);
}
