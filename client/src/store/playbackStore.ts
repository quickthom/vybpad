/**
 * Playback + Tone.js readiness (TASK-4.1). Extends INTERFACES.md `PlaybackStore` with
 * `audioReadyState` / `audioErrorMessage` / `initializeAudioFromUserGesture` — Architect to
 * fold into INTERFACES if accepted (PR blocking flag).
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { getPlaybackEngine, getPlaybackErrorMessage } from '../engine/audio';
import { useSongStore } from './songStore';

export type AudioReadyState = 'idle' | 'initializing' | 'ready' | 'error';

/** INTERFACES `PlaybackStore` + audio lifecycle for autoplay-policy compliance. */
export interface PlaybackStore {
  isPlaying: boolean;
  currentTick: number | null;
  isLooping: boolean;
  loopStart: number;
  loopEnd: number;

  audioReadyState: AudioReadyState;
  audioErrorMessage: string | null;

  initializeAudioFromUserGesture: () => Promise<void>;

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

    audioReadyState: 'idle',
    audioErrorMessage: null,

    initializeAudioFromUserGesture: async () => {
      if (getPlaybackEngine().isReady()) {
        set((draft) => {
          draft.audioReadyState = 'ready';
          draft.audioErrorMessage = null;
        });
        ensureTickSubscription(set);
        syncEngineFromSong();
        return;
      }
      if (get().audioReadyState === 'ready') {
        return;
      }
      if (!initChain) {
        initChain = (async () => {
          set((draft) => {
            draft.audioReadyState = 'initializing';
            draft.audioErrorMessage = null;
          });
          try {
            const engine = getPlaybackEngine();
            await engine.initialize();
            ensureTickSubscription(set);
            syncEngineFromSong();
            set((draft) => {
              draft.audioReadyState = 'ready';
            });
          } catch (err) {
            const message = getPlaybackErrorMessage(err);
            set((draft) => {
              draft.audioReadyState = 'error';
              draft.audioErrorMessage = message;
            });
          } finally {
            initChain = null;
          }
        })();
      }
      await initChain;
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
    audioReadyState: 'idle',
    audioErrorMessage: null,
  });
}
