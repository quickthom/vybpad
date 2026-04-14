/*
 * QA COVERAGE PLAN — TASK-4.9
 *
 * Criterion 1: Unit tests mock Tone.js — no real Web Audio / AudioContext
 *   happy: createPlaybackEngine runs under vi.mock('tone') + mocked piano loader
 *   error: N/A
 *   edges: N/A
 *
 * Criterion 2: Scheduling matches INTERFACES AudioEngine loadSong path + PAT-004 (48 TPQN)
 *   happy: Transport PPQ and BPM reflect initialize/loadSong/play; Tone.Part payloads match
 *           buildScheduledPlayEvents(song, theoryEngine) (tick-aligned `{time: "${tick}i"}` rows)
 *   error: N/A
 *   edges: seekTo drives onTick without Transport advancing ticks automatically
 */

import type { AudioEngine } from '@/engine/audio';
import { createPlaybackEngine } from '@/engine/audio';
import { buildScheduledPlayEvents } from '@/engine/audio/songScheduler';
import { theoryEngine } from '@/engine/theory/theoryEngine';
import type { ChordEvent, NoteEvent, SongData, Track, TrackRole } from '@vybpad/shared';
import { TICKS_PER_QUARTER } from '@vybpad/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { toneStart, transport, capturedParts, resetSchedulingMocks, MockPart } = vi.hoisted(() => {
  const capturedParts: Array<{ rawEvents: unknown }> = [];

  class MockPart {
    callback: (time: number | string, ev: unknown) => void;
    rawEvents: unknown;

    constructor(callback: (time: number | string, ev: unknown) => void, events?: unknown) {
      this.callback = callback;
      this.rawEvents = events;
      capturedParts.push({ rawEvents: events });
    }

    start = vi.fn().mockReturnThis();
    stop = vi.fn().mockReturnThis();
    dispose = vi.fn().mockReturnThis();
  }

  const bpmState = { value: 120 };

  const transport = {
    PPQ: 48,
    bpm: {
      get value() {
        return bpmState.value;
      },
      set value(v: number) {
        bpmState.value = v;
      },
      setValueAtTime: vi.fn((v: number) => {
        bpmState.value = v;
      }),
      cancelScheduledValues: vi.fn(),
    },
    ticks: 0,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
  };

  function resetSchedulingMocks(): void {
    capturedParts.length = 0;
    transport.PPQ = 48;
    bpmState.value = 120;
    transport.bpm.setValueAtTime = vi.fn((v: number) => {
      bpmState.value = v;
    });
    transport.bpm.cancelScheduledValues = vi.fn();
    transport.ticks = 0;
    transport.loop = false;
    transport.loopStart = 0;
    transport.loopEnd = 0;
    transport.start = vi.fn();
    transport.stop = vi.fn();
    transport.pause = vi.fn();
    transport.cancel = vi.fn();
  }

  return {
    toneStart: vi.fn<[], Promise<void>>(),
    transport,
    capturedParts,
    resetSchedulingMocks,
    MockPart,
  };
});

vi.mock('@/store/toastStore', () => ({
  useToastStore: {
    getState: () => ({ showError: vi.fn() }),
  },
}));

vi.mock('@/engine/audio/pianoSampleLoader', () => ({
  ensurePianoSamplesLoaded: vi.fn(() => Promise.resolve()),
  disposePianoSamples: vi.fn(),
  resetPianoSampleCacheForTests: vi.fn(),
  getPianoInstrument: vi.fn(() => ({
    start: vi.fn(),
  })),
}));

vi.mock('tone', () => ({
  __esModule: true,
  start: () => toneStart(),
  getTransport: () => transport,
  getContext: () => ({
    rawContext: { destination: {} },
  }),
  Time: vi.fn((val: string | number) => ({
    toSeconds: () => {
      if (typeof val === 'string' && /^\d+i$/i.test(String(val).trim())) {
        const ticks = Number.parseInt(val, 10);
        const bpm = transport.bpm.value;
        return (ticks / TICKS_PER_QUARTER) * (60 / bpm);
      }
      return typeof val === 'number' ? val : 0;
    },
  })),
  Part: MockPart,
}));

function makeTrack(role: TrackRole, overrides: Partial<Track> = {}): Track {
  const defaults: Record<TrackRole, Track> = {
    melody1: { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
    melody2: { role: 'melody2', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
    melody3: { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
    melody4: { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
    harmony: { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
    bass: { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
    drums: { role: 'drums', instrument: 'piano', volume: 0.0, mute: true, octave: 0 },
  };
  return { ...defaults[role], ...overrides, role };
}

function makeNote(id: string, beat: number, overrides: Partial<NoteEvent> = {}): NoteEvent {
  return {
    id,
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    beat,
    duration: TICKS_PER_QUARTER,
    isRest: false,
    velocity: 100,
    ...overrides,
  };
}

function makeChord(id: string, beat: number, overrides: Partial<ChordEvent> = {}): ChordEvent {
  return {
    id,
    scaleDegree: 1,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat,
    duration: TICKS_PER_QUARTER,
    ...overrides,
  };
}

function sampleSong(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-4.9 scheduling',
      key: 'C',
      scale: 'major',
      tempo: 132,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: 'a0000000-0000-4000-8000-000000000001',
        chords: [
          makeChord('b0000000-0000-4000-8000-000000000001', 0, {
            scaleDegree: 4,
            quality: 'major',
            duration: 96,
          }),
        ],
        notes: [
          [
            makeNote('c0000000-0000-4000-8000-000000000001', 0, {
              scaleDegree: 1,
              duration: 48,
            }),
          ],
          [],
          [],
          [],
        ],
      },
      {
        id: 'a0000000-0000-4000-8000-000000000002',
        chords: [],
        notes: [
          [
            makeNote('c0000000-0000-4000-8000-000000000002', 24, {
              scaleDegree: 3,
              duration: 24,
            }),
          ],
          [],
          [],
          [],
        ],
      },
    ],
    bandConfig: {
      tracks: [
        makeTrack('melody1'),
        makeTrack('melody2'),
        makeTrack('melody3'),
        makeTrack('melody4'),
        makeTrack('harmony'),
        makeTrack('bass'),
        makeTrack('drums'),
      ],
    },
  };
}

function expectedPartRows(song: SongData): Array<Record<string, unknown>> {
  return buildScheduledPlayEvents(song, theoryEngine).map((ev) => ({
    time: `${ev.tick}i`,
    tick: ev.tick,
    durationTicks: ev.durationTicks,
    midi: ev.midi,
    velocity: ev.velocity,
    role: ev.role,
  }));
}

function polyfillRaf(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number;
  }
  if (typeof globalThis.cancelAnimationFrame !== 'function') {
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }
}

describe('Playback scheduling — TASK-4.9 — mocked Tone.js (no Web Audio)', () => {
  let engine: AudioEngine | null = null;

  beforeEach(() => {
    polyfillRaf();
    vi.clearAllMocks();
    resetSchedulingMocks();
    toneStart.mockResolvedValue(undefined);
    engine = createPlaybackEngine();
  });

  afterEach(() => {
    engine?.dispose();
    engine = null;
  });

  describe('happy path', () => {
    it('sets Transport PPQ to 48 (PAT-004 TPQN) during initialize()', async () => {
      transport.PPQ = 7;
      await engine!.initialize();
      expect(transport.PPQ).toBe(TICKS_PER_QUARTER);
    });

    it('schedules Tone.Part rows that exactly match buildScheduledPlayEvents for loadSong', async () => {
      const song = sampleSong();
      await engine!.initialize();

      engine!.loadSong(song);

      expect(transport.bpm.value).toBe(song.metadata.tempo);
      expect(capturedParts).toHaveLength(1);

      const raw = capturedParts[0]!.rawEvents;
      expect(Array.isArray(raw)).toBe(true);
      expect(raw).toEqual(expectedPartRows(song));
    });

    it('applies song tempo to Transport bpm on play() when a song is loaded', async () => {
      const song = sampleSong();
      await engine!.initialize();
      engine!.loadSong(song);
      transport.bpm.value = 40;

      vi.stubGlobal('requestAnimationFrame', () => 0);
      try {
        engine!.play();
        expect(transport.bpm.value).toBe(song.metadata.tempo);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('delivers seekTo positions to onTick subscribers', async () => {
      await engine!.initialize();
      const ticks: number[] = [];
      const unsub = engine!.onTick((t) => {
        ticks.push(t);
      });

      engine!.seekTo(144);
      engine!.stop();
      unsub();

      expect(ticks).toContain(144);
      expect(ticks).toContain(0);
    });
  });
});
