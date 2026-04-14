/**
 * TASK-5.8 — playback adapts to measure-level tempo, meter, key, and scale; loadSong clears stale Parts.
 */
import type { AudioEngine } from '@/engine/audio';
import { createPlaybackEngine } from '@/engine/audio';
import { buildScheduledPlayEvents } from '@/engine/audio/songScheduler';
import { theoryEngine } from '@/engine/theory/theoryEngine';
import {
  getMeasureStartTicks,
  getMeasureStartTransportTimes,
} from '@/engine/renderer/tickUtils';
import type { ChordEvent, NoteEvent, SongData, Track, TrackRole } from '@vybpad/shared';
import { TICKS_PER_QUARTER } from '@vybpad/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { toneStart, transport, capturedParts, resetSchedulingMocks, MockPart, disposeRef } = vi.hoisted(
  () => {
    const capturedParts: Array<{ rawEvents: unknown }> = [];
    const disposeRef = { count: 0 };

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
      dispose = vi.fn().mockImplementation(() => {
        disposeRef.count += 1;
        return this;
      });
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
      disposeRef.count = 0;
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
      disposeRef,
    };
  },
);

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

function band(): SongData['bandConfig'] {
  return {
    tracks: [
      makeTrack('melody1'),
      makeTrack('melody2'),
      makeTrack('melody3'),
      makeTrack('melody4'),
      makeTrack('harmony'),
      makeTrack('bass'),
      makeTrack('drums'),
    ],
  };
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

describe('TASK-5.8 playback adaptation', () => {
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

  it('schedules melody at ticks from getMeasureStartTicks when tempo differs after M0', async () => {
    const song: SongData = {
      version: '1.0',
      metadata: {
        title: 'tempo map',
        key: 'C',
        scale: 'major',
        tempo: 120,
        meter: { numerator: 4, denominator: 4 },
      },
      measures: [
        {
          id: 'm0',
          chords: [],
          notes: [
            [makeNote('n0', 0, { scaleDegree: 1 })],
            [],
            [],
            [],
          ],
        },
        {
          id: 'm1',
          chords: [],
          notes: [
            [makeNote('n1', 0, { scaleDegree: 2 })],
            [],
            [],
            [],
          ],
          changes: { tempo: 60 },
        },
      ],
      bandConfig: band(),
    };

    const starts = getMeasureStartTicks(song);
    expect(starts[1]).toBe(192);
    const tTimes = getMeasureStartTransportTimes(song);
    expect(tTimes[0]).toBe(0);
    // M0: 192 ticks at 120 BPM → 4 beats × 0.5s = 2s
    expect(tTimes[1]).toBeCloseTo(2, 5);

    const evs = buildScheduledPlayEvents(song, theoryEngine);
    const m0 = evs.find((e) => e.role === 'melody1' && e.tick === 0);
    const m1 = evs.find((e) => e.role === 'melody1' && e.tick === 192);
    expect(m0).toBeDefined();
    expect(m1).toBeDefined();

    const calls = transport.bpm.setValueAtTime as ReturnType<typeof vi.fn>;
    await engine!.initialize();
    engine!.loadSong(song);
    expect(calls.mock.calls.some((c) => c[0] === 120 && c[1] === 0)).toBe(true);
    expect(calls.mock.calls.some((c) => c[0] === 60 && c[1] === 2)).toBe(true);
  });

  it('places events on meter-change boundaries per measureLengthInTicks / inheritance', () => {
    const song: SongData = {
      version: '1.0',
      metadata: {
        title: 'meter',
        key: 'C',
        scale: 'major',
        tempo: 120,
        meter: { numerator: 4, denominator: 4 },
      },
      measures: [
        { id: 'm0', chords: [], notes: [[makeNote('a', 0)], [], [], []] },
        {
          id: 'm1',
          chords: [],
          notes: [[], [], [], []],
          changes: { meter: { numerator: 3, denominator: 4 } },
        },
        { id: 'm2', chords: [], notes: [[makeNote('b', 0, { scaleDegree: 3 })], [], [], []] },
      ],
      bandConfig: band(),
    };

    const starts = getMeasureStartTicks(song);
    expect(starts[2]).toBe(192 + 144);
    const evs = buildScheduledPlayEvents(song, theoryEngine);
    const m2 = evs.find((e) => e.role === 'melody1' && e.tick === 192 + 144);
    expect(m2).toBeDefined();
  });

  it('uses key/scale after M0 for melody and harmony MIDI', () => {
    const song: SongData = {
      version: '1.0',
      metadata: {
        title: 'key',
        key: 'C',
        scale: 'major',
        tempo: 120,
        meter: { numerator: 4, denominator: 4 },
      },
      measures: [
        {
          id: 'm0',
          chords: [makeChord('c0', 0, { scaleDegree: 1, duration: 192 })],
          notes: [[makeNote('n0', 0, { scaleDegree: 1 })], [], [], []],
        },
        {
          id: 'm1',
          chords: [makeChord('c1', 0, { scaleDegree: 1, duration: 192 })],
          notes: [[makeNote('n1', 0, { scaleDegree: 1 })], [], [], []],
          changes: { key: 'D', scale: 'major' },
        },
      ],
      bandConfig: band(),
    };

    const evs = buildScheduledPlayEvents(song, theoryEngine);
    const mel0 = evs.find((e) => e.role === 'melody1' && e.tick === 0);
    const mel1 = evs.find((e) => e.role === 'melody1' && e.tick === 192);
    expect(mel0?.midi).toBe(theoryEngine.scaleDegreeToMidi(1, 0, 0, 'C', 'major', 4));
    expect(mel1?.midi).toBe(theoryEngine.scaleDegreeToMidi(1, 0, 0, 'D', 'major', 4));

    const harm0 = evs.find((e) => e.role === 'harmony' && e.tick === 0);
    const harm192 = evs.find((e) => e.role === 'harmony' && e.tick === 192);
    expect(harm0).toBeDefined();
    expect(harm192).toBeDefined();
    expect(harm0!.midi).not.toBe(harm192!.midi);
  });

  it('disposes prior Tone.Part when loadSong replaces a mutated snapshot', async () => {
    const songA: SongData = {
      version: '1.0',
      metadata: {
        title: 'a',
        key: 'C',
        scale: 'major',
        tempo: 120,
        meter: { numerator: 4, denominator: 4 },
      },
      measures: [
        {
          id: 'm0',
          chords: [],
          notes: [[makeNote('n', 0)], [], [], []],
        },
      ],
      bandConfig: band(),
    };

    const songB: SongData = {
      ...songA,
      measures: [
        {
          id: 'm0',
          chords: [],
          notes: [[makeNote('n2', 0, { scaleDegree: 5 })], [], [], []],
        },
      ],
    };

    await engine!.initialize();
    engine!.loadSong(songA);
    expect(capturedParts).toHaveLength(1);
    const firstPart = capturedParts[0];
    engine!.loadSong(songB);
    expect(disposeRef.count).toBeGreaterThanOrEqual(1);
    expect(capturedParts).toHaveLength(2);
    expect((firstPart as { rawEvents: unknown }).rawEvents).not.toEqual(
      (capturedParts[1] as { rawEvents: unknown }).rawEvents,
    );
  });
});
