/**
 * Zustand `PlaybackStore` per INTERFACES.md (init lifecycle + transport).
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import {
  getPlaybackEngine,
  getPlaybackInitErrorCode,
  type PlaybackInitErrorCode,
  type PlaybackInitStatus,
} from '../engine/audio';
import { useSongStore } from './songStore';

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

  initializeAudio: () => Promise<void>;
  clearInitError: () => void;

  play: () => void;
  pause: () => void;
  stop: () => void;
  rewind: () => void;
  seekTo: (tick: number) => void;
  setLoop: (start: number, end: number) => void;
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
  engine.loadSong(useSongStore.getState().song);
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
      const { isLooping, loopStart, loopEnd } = get();
      engine.setLoop(isLooping, loopStart, loopEnd);
      engine.play();
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
        draft.currentTick = 0;
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
      set((draft) => {
        draft.isLooping = true;
        draft.loopStart = start;
        draft.loopEnd = end;
      });
      if (getPlaybackEngine().isReady()) {
        getPlaybackEngine().setLoop(true, start, end);
      }
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
  });
}
