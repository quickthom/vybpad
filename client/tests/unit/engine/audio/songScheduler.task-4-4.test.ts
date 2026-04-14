/*
 * QA COVERAGE PLAN — TASK-4.4
 *
 * Criterion 1: loadSong builds schedules from SongData for melody + harmony + bass tracks; reload clears prior schedule state
 *   happy: melody-only songs produce one scheduled Tone.Part; chord-only songs produce harmony + bass parts
 *   error: reload should not keep stale song-A callbacks/events alive after song-B load
 *   edges: empty voices do not create extra non-empty parts
 *
 * Criterion 2: Events align to correct absolute ticks / TPQN across measures
 *   happy: measure-relative note/chord beats become absolute tick times using the 48-TPQN contract
 *   error: N/A
 *   edges: meter change in later measure shifts subsequent absolute tick offsets correctly
 *
 * Criterion 3: play / stop / seekTo / dispose do not leak scheduled Tone callbacks or duplicate triggers
 *   happy: replay fires the same note count each cycle; seekTo updates transport position without audible duplicates
 *   error: dispose removes live scheduled callbacks
 *   edges: repeated load/play cycles do not accumulate stale parts
 *
 * Criterion 4: setTrackVolume / setTrackMute affect per-track output
 *   happy: muting a track changes observable output-state and/or suppresses emitted note playback for the active track
 *   error: N/A
 *   edges: a second volume change remains observable without rebuilding the whole engine
 *
 * Criterion 5: No regression against TASK-4.3 harmony voicing behavior covered by existing tests
 *   happy: scheduled harmony+bass playback emits the same combined MIDI note set as buildHarmonyVoicingSequence()
 *   error: N/A
 *   edges: dominant seventh + inversion path still schedules bass + harmony together
 */

import type { AudioEngine } from '@/engine/audio';
import { buildHarmonyVoicingSequence, createPlaybackEngine } from '@/engine/audio';
import { theoryEngine } from '@/engine/theory';
import type { ChordEvent, NoteEvent, SongData, Track, TrackRole } from '@vybpad/shared';
import { TICKS_PER_QUARTER } from '@vybpad/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ScheduledTime = number | string;

interface ScheduledEvent {
  time: ScheduledTime;
  value: unknown;
}

interface PianoCall {
  method: string;
  args: unknown[];
}

const {
  toneStart,
  transport,
  pianoCalls,
  pianoInstrument,
  mockParts,
  mockGains,
  mockVolumes,
  mockChannels,
  resetToneMockState,
  MockPart,
  MockGain,
  MockVolume,
  MockChannel,
} = vi.hoisted(() => {
  const pianoCalls: PianoCall[] = [];
  const mockParts: MockPart[] = [];
  const mockGains: MockGain[] = [];
  const mockVolumes: MockVolume[] = [];
  const mockChannels: MockChannel[] = [];

  function normalizeEventInput(timeOrEvent: unknown, value?: unknown): ScheduledEvent[] {
    if (Array.isArray(timeOrEvent)) {
      return timeOrEvent.flatMap((entry) => normalizeEventInput(entry));
    }
    if (
      typeof timeOrEvent === 'object' &&
      timeOrEvent !== null &&
      'time' in timeOrEvent &&
      Object.prototype.hasOwnProperty.call(timeOrEvent, 'value')
    ) {
      const event = timeOrEvent as { time: ScheduledTime; value: unknown };
      return [{ time: event.time, value: event.value }];
    }
    if (typeof timeOrEvent === 'number' || typeof timeOrEvent === 'string') {
      return [{ time: timeOrEvent, value }];
    }
    return [];
  }

  class MockPart {
    callback: (time: ScheduledTime, value: unknown) => void;
    events: ScheduledEvent[];
    started = false;
    disposed = false;

    constructor(callback: (time: ScheduledTime, value: unknown) => void, events?: unknown) {
      this.callback = callback;
      this.events = events === undefined ? [] : normalizeEventInput(events);
      mockParts.push(this);
    }

    add(timeOrEvent: unknown, value?: unknown): this {
      this.events.push(...normalizeEventInput(timeOrEvent, value));
      return this;
    }

    at(time: unknown, value?: unknown): this {
      return this.add(time, value);
    }

    clear(): this {
      this.events = [];
      return this;
    }

    removeAll(): this {
      this.events = [];
      return this;
    }

    start(_time?: unknown): this {
      this.started = true;
      return this;
    }

    stop(_time?: unknown): this {
      this.started = false;
      return this;
    }

    dispose(): this {
      this.started = false;
      this.disposed = true;
      this.events = [];
      return this;
    }
  }

  class MockGain {
    gain = { value: 1 };
    disposed = false;

    constructor(value = 1) {
      this.gain.value = value;
      mockGains.push(this);
    }

    connect(): this {
      return this;
    }

    chain(): this {
      return this;
    }

    fan(): this {
      return this;
    }

    toDestination(): this {
      return this;
    }

    disconnect(): this {
      return this;
    }

    dispose(): this {
      this.disposed = true;
      return this;
    }
  }

  class MockVolume {
    volume = { value: 0 };
    mute = false;
    disposed = false;

    constructor(value = 0) {
      this.volume.value = value;
      mockVolumes.push(this);
    }

    connect(): this {
      return this;
    }

    chain(): this {
      return this;
    }

    fan(): this {
      return this;
    }

    toDestination(): this {
      return this;
    }

    disconnect(): this {
      return this;
    }

    dispose(): this {
      this.disposed = true;
      return this;
    }
  }

  class MockChannel {
    volume = { value: 0 };
    pan = { value: 0 };
    mute = false;
    disposed = false;

    constructor(volume = 0) {
      this.volume.value = volume;
      mockChannels.push(this);
    }

    connect(): this {
      return this;
    }

    chain(): this {
      return this;
    }

    fan(): this {
      return this;
    }

    toDestination(): this {
      return this;
    }

    disconnect(): this {
      return this;
    }

    dispose(): this {
      this.disposed = true;
      return this;
    }
  }

  const transport = {
    PPQ: 48,
    bpm: { value: 120 },
    ticks: 0,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
  };

  const pianoInstrument = {
    connect() {
      return this;
    },
    chain() {
      return this;
    },
    disconnect() {},
    releaseAll() {},
    start(...args: unknown[]) {
      pianoCalls.push({ method: 'start', args });
    },
    play(...args: unknown[]) {
      pianoCalls.push({ method: 'play', args });
    },
    triggerAttack(...args: unknown[]) {
      pianoCalls.push({ method: 'triggerAttack', args });
    },
    triggerAttackRelease(...args: unknown[]) {
      pianoCalls.push({ method: 'triggerAttackRelease', args });
    },
  };

  function resetToneMockState(): void {
    pianoCalls.length = 0;
    mockParts.length = 0;
    mockGains.length = 0;
    mockVolumes.length = 0;
    mockChannels.length = 0;
    transport.PPQ = 48;
    transport.bpm.value = 120;
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
    pianoCalls,
    pianoInstrument,
    mockParts,
    mockGains,
    mockVolumes,
    mockChannels,
    resetToneMockState,
    MockPart,
    MockGain,
    MockVolume,
    MockChannel,
  };
});

vi.mock('@/engine/audio/pianoSampleLoader', () => ({
  ensurePianoSamplesLoaded: vi.fn(() => Promise.resolve()),
  disposePianoSamples: vi.fn(),
  getPianoInstrument: vi.fn(() => pianoInstrument),
  resetPianoSampleCacheForTests: vi.fn(),
}));

vi.mock('tone', () => ({
  __esModule: true,
  start: () => toneStart(),
  getTransport: () => transport,
  getContext: () => ({
    rawContext: {
      sampleRate: 44_100,
      decodeAudioData: vi.fn(),
    },
  }),
  getDestination: () => ({ connect: () => undefined }),
  Destination: { connect: () => undefined },
  now: () => transport.ticks,
  Part: MockPart,
  Gain: MockGain,
  Volume: MockVolume,
  Channel: MockChannel,
}));

let engine: AudioEngine | null = null;

function polyfillRaf(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number;
  }
  if (typeof globalThis.cancelAnimationFrame !== 'function') {
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }
}

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

  return {
    ...defaults[role],
    ...overrides,
    role,
  };
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

function baseSong(): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'TASK-4.4 QA fixture',
      key: 'C',
      scale: 'major',
      tempo: 108,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [],
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

function buildMelodyOnlySong(): SongData {
  const song = baseSong();
  song.metadata.title = 'melody scheduler';
  song.measures = [
    {
      id: '10000000-0000-4000-8000-000000000001',
      chords: [],
      notes: [
        [makeNote('20000000-0000-4000-8000-000000000001', 0, { scaleDegree: 1, duration: 48 })],
        [],
        [],
        [],
      ],
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      chords: [],
      notes: [
        [
          makeNote('20000000-0000-4000-8000-000000000002', 24, {
            scaleDegree: 5,
            octave: 1,
            duration: 72,
          }),
        ],
        [],
        [],
        [],
      ],
      changes: {
        meter: { numerator: 3, denominator: 4 },
      },
    },
  ];
  return song;
}

function buildChordOnlySong(): SongData {
  const song = baseSong();
  song.metadata.title = 'harmony+bass scheduler';
  song.measures = [
    {
      id: '11000000-0000-4000-8000-000000000001',
      chords: [
        makeChord('21000000-0000-4000-8000-000000000001', 48, {
          scaleDegree: 1,
          quality: 'major',
          duration: 48,
        }),
      ],
      notes: [[], [], [], []],
    },
    {
      id: '11000000-0000-4000-8000-000000000002',
      chords: [
        makeChord('21000000-0000-4000-8000-000000000002', 0, {
          scaleDegree: 5,
          quality: 'major',
          seventh: 'dom7',
          inversion: 1,
          duration: 96,
        }),
      ],
      notes: [[], [], [], []],
    },
  ];
  return song;
}

function buildReloadSong(): SongData {
  const song = baseSong();
  song.metadata.title = 'reload song';
  song.measures = [
    {
      id: '12000000-0000-4000-8000-000000000001',
      chords: [
        makeChord('22000000-0000-4000-8000-000000000001', 96, {
          scaleDegree: 6,
          quality: 'minor',
          seventh: 'min7',
          duration: 48,
        }),
      ],
      notes: [[], [], [], []],
    },
  ];
  return song;
}

function measureLengthTicks(numerator: number, denominator: number): number {
  return (numerator * 4 * TICKS_PER_QUARTER) / denominator;
}

function measureStartTicks(song: SongData): number[] {
  const starts = [0];
  let currentMeter = song.metadata.meter;
  for (let i = 0; i < song.measures.length; i += 1) {
    const measure = song.measures[i]!;
    if (measure.changes?.meter) {
      currentMeter = measure.changes.meter;
    }
    starts.push(starts[i]! + measureLengthTicks(currentMeter.numerator, currentMeter.denominator));
  }
  return starts;
}

function absoluteTick(song: SongData, measureIndex: number, beat: number): number {
  return measureStartTicks(song)[measureIndex]! + beat;
}

function toTicks(time: ScheduledTime): number {
  if (typeof time === 'number') {
    return time;
  }
  if (/^\d+i$/.test(time)) {
    return Number.parseInt(time.slice(0, -1), 10);
  }
  return Number.NaN;
}

function activeScheduledParts(): MockPart[] {
  return mockParts.filter((part) => !part.disposed && part.events.length > 0);
}

function clearPianoCalls(): void {
  pianoCalls.length = 0;
}

function extractNotesFromValue(value: unknown): number[] {
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'number')) {
    return value as number[];
  }
  if (typeof value === 'number') {
    return [value];
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;
  for (const key of ['note', 'notes', 'midi', 'midiNote', 'midiNotes', 'pitch', 'pitches']) {
    const candidate = record[key];
    if (Array.isArray(candidate) && candidate.every((entry) => typeof entry === 'number')) {
      return candidate as number[];
    }
    if (typeof candidate === 'number') {
      return [candidate];
    }
  }

  return [];
}

function extractDurationTicks(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && /^\d+i$/.test(value)) {
    return Number.parseInt(value.slice(0, -1), 10);
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of ['duration', 'durationTicks', 'length']) {
    const candidate = record[key];
    if (typeof candidate === 'number') {
      return candidate;
    }
    if (typeof candidate === 'string' && /^\d+i$/.test(candidate)) {
      return Number.parseInt(candidate.slice(0, -1), 10);
    }
  }
  return null;
}

function playedMidi(): number[] {
  return pianoCalls.flatMap((call) => call.args.flatMap((arg) => extractNotesFromValue(arg)));
}

function playedDurations(): number[] {
  return pianoCalls
    .map((call) => call.args.map((arg) => extractDurationTicks(arg)).find((value) => value !== null) ?? null)
    .filter((value): value is number => value !== null);
}

function extractOutputLevel(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of ['velocity', 'gain', 'volume']) {
    const candidate = record[key];
    if (typeof candidate === 'number') {
      return candidate;
    }
  }
  return null;
}

function firstObservedOutputLevel(): number | null {
  for (const call of pianoCalls) {
    for (const arg of call.args) {
      const level = extractOutputLevel(arg);
      if (level !== null) {
        return level;
      }
    }
  }
  return null;
}

function snapshotTrackNodes(): string {
  return JSON.stringify({
    gains: mockGains.map((node) => node.gain.value),
    volumes: mockVolumes.map((node) => ({ volume: node.volume.value, mute: node.mute })),
    channels: mockChannels.map((node) => ({ volume: node.volume.value, mute: node.mute })),
  });
}

function fireAt(tick: number): void {
  transport.ticks = tick;
  for (const part of mockParts) {
    if (!part.started || part.disposed) {
      continue;
    }
    for (const event of part.events) {
      if (toTicks(event.time) === tick) {
        part.callback(event.time, event.value);
      }
    }
  }
}

describe('Song scheduler — TASK-4.4 — Tone.Part scheduling contract', () => {
  beforeEach(() => {
    polyfillRaf();
    resetToneMockState();
    toneStart.mockReset();
    toneStart.mockResolvedValue(undefined);
    engine = createPlaybackEngine();
  });

  afterEach(() => {
    engine?.dispose();
    engine = null;
  });

  describe('happy path', () => {
    it('builds one melody Tone.Part whose events land on absolute ticks across a meter change', async () => {
      const song = buildMelodyOnlySong();
      await engine!.initialize();

      engine!.loadSong(song);

      const parts = activeScheduledParts();
      expect(parts).toHaveLength(1);
      expect(parts[0]!.events.map((event) => toTicks(event.time))).toEqual([
        absoluteTick(song, 0, 0),
        absoluteTick(song, 1, 24),
      ]);

      engine!.play();
      fireAt(absoluteTick(song, 0, 0));
      fireAt(absoluteTick(song, 1, 24));

      expect(playedMidi()).toEqual([
        theoryEngine.scaleDegreeToMidi(1, 0, 0, 'C', 'major'),
        theoryEngine.scaleDegreeToMidi(5, 1, 0, 'C', 'major'),
      ]);
      expect(playedDurations()).toEqual([48, 72]);
    });

    it('schedules harmony+bass parts whose emitted MIDI matches TASK-4.3 harmony voicing output', async () => {
      const song = buildChordOnlySong();
      const expectedSequence = buildHarmonyVoicingSequence(song);
      await engine!.initialize();

      engine!.loadSong(song);

      const parts = activeScheduledParts();
      expect(parts).toHaveLength(2);
      const expectedTicks = expectedSequence.map((step) =>
        absoluteTick(song, step.measureIndex, step.chord.beat),
      );
      for (const part of parts) {
        expect(part.events.map((event) => toTicks(event.time))).toEqual(expectedTicks);
      }

      engine!.play();
      for (const [index, step] of expectedSequence.entries()) {
        clearPianoCalls();
        fireAt(expectedTicks[index]!);
        expect(playedMidi().slice().sort((a, b) => a - b)).toEqual(
          [step.voicing.bassMidi, ...step.voicing.harmonyMidi].slice().sort((a, b) => a - b),
        );
      }
    });
  });

  describe('reload + lifecycle leaks', () => {
    it('clears prior scheduled state on reload and does not duplicate triggers across stop/play/seek/dispose', async () => {
      const firstSong = buildChordOnlySong();
      const reloadSong = buildReloadSong();
      const firstTick = absoluteTick(firstSong, 0, 48);
      const reloadTick = absoluteTick(reloadSong, 0, 96);

      await engine!.initialize();

      engine!.loadSong(firstSong);
      engine!.play();
      clearPianoCalls();
      fireAt(firstTick);
      const firstCycleCount = playedMidi().length;
      expect(firstCycleCount).toBeGreaterThan(0);

      clearPianoCalls();
      engine!.stop();
      engine!.play();
      fireAt(firstTick);
      expect(playedMidi()).toHaveLength(firstCycleCount);

      clearPianoCalls();
      engine!.seekTo(reloadTick);
      expect(playedMidi()).toEqual([]);

      engine!.stop();
      engine!.loadSong(reloadSong);
      engine!.play();

      clearPianoCalls();
      fireAt(firstTick);
      expect(playedMidi()).toEqual([]);

      clearPianoCalls();
      fireAt(reloadTick);
      expect(playedMidi().length).toBeGreaterThan(0);

      clearPianoCalls();
      engine!.dispose();
      fireAt(reloadTick);
      expect(playedMidi()).toEqual([]);
    });
  });

  describe('per-track output controls', () => {
    it('makes track mute and volume changes observable for the active melody track', async () => {
      const song = buildMelodyOnlySong();
      const noteTick = absoluteTick(song, 0, 0);
      await engine!.initialize();
      engine!.loadSong(song);
      engine!.play();

      const beforeMuteNodes = snapshotTrackNodes();
      engine!.setTrackMute('melody1', true);
      const afterMuteNodes = snapshotTrackNodes();

      clearPianoCalls();
      fireAt(noteTick);

      if (afterMuteNodes === beforeMuteNodes) {
        expect(playedMidi()).toEqual([]);
      } else {
        expect(afterMuteNodes).not.toEqual(beforeMuteNodes);
        engine!.setTrackMute('melody1', false);
        expect(snapshotTrackNodes()).not.toEqual(afterMuteNodes);
      }

      const beforeVolumeNodes = snapshotTrackNodes();
      engine!.setTrackVolume('melody1', 0.2);
      const lowVolumeNodes = snapshotTrackNodes();

      if (lowVolumeNodes === beforeVolumeNodes) {
        clearPianoCalls();
        fireAt(noteTick);
        const lowLevel = firstObservedOutputLevel();

        engine!.setTrackVolume('melody1', 0.85);
        clearPianoCalls();
        fireAt(noteTick);
        const highLevel = firstObservedOutputLevel();

        expect(lowLevel).not.toBeNull();
        expect(highLevel).not.toBeNull();
        expect(highLevel).not.toBe(lowLevel);
      } else {
        expect(lowVolumeNodes).not.toEqual(beforeVolumeNodes);
        engine!.setTrackVolume('melody1', 0.85);
        expect(snapshotTrackNodes()).not.toEqual(lowVolumeNodes);
      }
    });
  });
});
