import type { SongData, TrackRole } from '@vybpad/shared';
import { TICKS_PER_QUARTER } from '@vybpad/shared';
import * as Tone from 'tone';

import {
  getMeasureStartTransportTimes,
  getTempoAtMeasure,
  measureIndexFromAbsoluteTick,
} from '../renderer/tickUtils';
import { theoryEngine } from '../theory/theoryEngine';
import { useToastStore } from '../../store/toastStore';
import type { AudioEngine } from './audioEngineTypes';
import {
  getPlaybackErrorMessage,
  PLAYBACK_ERROR_CODES,
  PlaybackError,
  playbackError,
} from './playbackErrors';
import { assertValidHarmonyVoicingSong } from './harmonyVoicing';
import { disposePianoSamples, ensurePianoSamplesLoaded, getPianoInstrument } from './pianoSampleLoader';
import { buildScheduledPlayEvents, type ScheduledPlayEvent } from './songScheduler';

const TPQN = TICKS_PER_QUARTER;

/** Editor melody-lane visibility for scheduling (RA-7); reset when the playback engine is disposed. */
let playbackMelodyVoiceVisible: readonly [boolean, boolean, boolean, boolean] = [true, true, true, true];

/** Shell syncs this from `useUIStore` before `loadSong` so hidden melody lanes never reach Tone.Part. */
export function setPlaybackMelodyVoiceVisibleForScheduling(
  visible: readonly [boolean, boolean, boolean, boolean],
): void {
  playbackMelodyVoiceVisible = visible;
}

type MixerChannel = { volume: number; mute: boolean };
type MixerState = Partial<Record<TrackRole, MixerChannel>>;

function clampVolume(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function syncMixerFromBand(song: SongData): MixerState {
  const mixer: MixerState = {};
  for (const t of song.bandConfig.tracks) {
    mixer[t.role] = { volume: clampVolume(t.volume), mute: t.mute };
  }
  return mixer;
}

/**
 * Creates the Tone.js-backed playback engine. The module imports Tone.js (no `AudioContext.resume`
 * until {@link AudioEngine.initialize} calls `Tone.start()` after a user gesture).
 */
export function createPlaybackEngine(): AudioEngine {
  /** Single in-flight init; repeated callers await the same promise (idempotent success path). */
  let initPromise: Promise<void> | null = null;
  let ready = false;

  let songRef: SongData | null = null;
  /** Live per-track gain/mute; updated from {@link loadSong} and transport controls (PAT-026). */
  let mixer: MixerState = {};
  const scheduledParts: Tone.Part[] = [];

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

  function clearScheduledPlayback(): void {
    try {
      Tone.getTransport().cancel();
    } catch {
      /* best-effort */
    }
    try {
      const bpmParam = Tone.getTransport().bpm;
      if (typeof bpmParam.cancelScheduledValues === 'function') {
        bpmParam.cancelScheduledValues(0);
      }
    } catch {
      /* best-effort */
    }
    for (const p of scheduledParts) {
      try {
        p.stop(0);
        p.dispose();
      } catch {
        /* best-effort */
      }
    }
    scheduledParts.length = 0;
  }

  /**
   * Piecewise-constant BPM at each measure start (Transport seconds) so `getTimeOfTick` / tick
   * scheduling match inherited `getTempoAtMeasure` values. Tone exposes one BPM signal; stepped
   * automation is the supported way to approximate a tempo map (TASK-5.8).
   */
  function applyTransportTempoMap(song: SongData): void {
    const tb = Tone.getTransport().bpm;
    if (typeof tb.setValueAtTime !== 'function') {
      const tickNow = Tone.getTransport().ticks;
      const mi = measureIndexFromAbsoluteTick(song, tickNow);
      tb.value = getTempoAtMeasure(song, mi);
      return;
    }
    const n = song.measures.length;
    const times = getMeasureStartTransportTimes(song);
    if (n === 0) {
      tb.setValueAtTime(getTempoAtMeasure(song, 0), 0);
      return;
    }
    for (let i = 0; i < n; i += 1) {
      tb.setValueAtTime(getTempoAtMeasure(song, i), times[i] ?? 0);
    }
  }

  function playScheduledEvent(time: number, ev: ScheduledPlayEvent): void {
    const ch = mixer[ev.role];
    const vol = ch ? (ch.mute ? 0 : ch.volume) : 1;
    if (vol <= 0) {
      return;
    }
    const piano = getPianoInstrument();
    if (!piano) {
      return;
    }
    const durSec = Tone.Time(`${ev.durationTicks}i`).toSeconds();
    const vel = Math.max(1, Math.min(127, Math.round(ev.velocity * vol)));
    piano.start({
      note: ev.midi,
      time,
      duration: durSec,
      velocity: vel,
    });
  }

  function schedulePlaybackFromSong(song: SongData): void {
    clearScheduledPlayback();
    mixer = syncMixerFromBand(song);
    applyTransportTempoMap(song);

    const flat = buildScheduledPlayEvents(song, theoryEngine, {
      melodyVoiceVisible: playbackMelodyVoiceVisible,
    });
    if (flat.length === 0) {
      return;
    }

    const partEvents = flat.map((ev) => ({
      time: `${ev.tick}i`,
      ...ev,
    }));

    const part = new Tone.Part((time, ev: ScheduledPlayEvent) => {
      playScheduledEvent(time, ev);
    }, partEvents);
    part.start(0);
    scheduledParts.push(part);
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

        // INTERFACES: initialize() loads Tone context + lazy piano SoundFont (smplr); second init
        // reuses module-level buffers via ensurePianoSamplesLoaded + CacheStorage.
        await ensurePianoSamplesLoaded();

        ready = true;

        if (songRef) {
          try {
            assertValidHarmonyVoicingSong(songRef);
            schedulePlaybackFromSong(songRef);
          } catch {
            /* song ref present but invalid — leave unscheduled until next loadSong */
          }
        }
      })();

      try {
        await initPromise;
      } catch (err) {
        initPromise = null;
        ready = false;
        clearScheduledPlayback();
        disposePianoSamples();
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
      assertValidHarmonyVoicingSong(song);
      songRef = song;
      if (!ready) {
        return;
      }
      schedulePlaybackFromSong(song);
    },

    play(): void {
      if (!ready) {
        return;
      }
      if (songRef) {
        applyTransportTempoMap(songRef);
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
      if (!mixer[role]) {
        mixer[role] = { volume: 1, mute: false };
      }
      const ch = mixer[role];
      if (ch) {
        ch.volume = clampVolume(volume);
      }
    },

    setTrackMute(role: TrackRole, mute: boolean): void {
      if (!mixer[role]) {
        mixer[role] = { volume: 1, mute: false };
      }
      const ch = mixer[role];
      if (ch) {
        ch.mute = mute;
      }
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
      clearScheduledPlayback();
      mixer = {};
      disposePianoSamples();
      ready = false;
      initPromise = null;
      try {
        Tone.getTransport().stop();
        Tone.getTransport().cancel();
      } catch {
        /* dispose is best-effort */
      }
      songRef = null;
      playbackMelodyVoiceVisible = [true, true, true, true];
    },
  };
}
