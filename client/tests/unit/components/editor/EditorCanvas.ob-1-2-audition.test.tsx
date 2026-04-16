/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — OB-1 + OB-2
 *
 * OB-1 — Note click audition (preview)
 *   happy: pointer tap (down + up, movement < DRAG_THRESHOLD_PX) on a melody note body invokes the
 *     PAT-026 audio gesture path and triggers a one-shot piano preview for that note’s resolved MIDI.
 *   error: —
 *   edges: —
 *
 * OB-2 — Chord click audition
 *   happy: pointer tap on a chord block in the bottom strip previews the chord voicing (multiple MIDI
 *     notes per INTERFACES `TheoryEngine.chordToMidiNotes` / engine voicing behavior).
 *   error: —
 *   edges: —
 *
 * PAT-026 — Playback initialization lifecycle (combined with audition)
 *   happy: audition from `initStatus: "locked"` runs through `PlaybackStore.initializeAudio` / engine
 *     init; on success `initStatus` becomes `"ready"` (non-throwing gesture path).
 *   error: —
 *   edges: rapid sequential taps still leave the store in a consistent ready state.
 *
 * Mocks: `tone` + `@/engine/audio/pianoSampleLoader` (smplr/Tone-free) — same strategy as playback tests.
 * Include `Tone.now` in the `tone` mock: audition schedules with `Tone.now()`; omitting it swallows preview (error caught upstream).
 * Expected MIDI values use `theoryEngine` + `buildHarmonyVoicingSequence` (same rules as audition voicing)
 * so this file does not import `auditionPreview.ts` (Builder-owned).
 *
 * Public surfaces: `EditorCanvas` interactions, `PlaybackStore.initializeAudio`, mocked piano `start`.
 */

import { randomUUID } from 'node:crypto';

import type { ChordEvent, NoteEvent, SongData, Viewport } from '@vybpad/shared';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { DRAG_THRESHOLD_PX } from '@/components/editor/pointerMath';
import { buildHarmonyVoicingSequence } from '@/engine/audio/harmonyVoicing';
import { getPlaybackEngine, resetPlaybackEngineForTests } from '@/engine/audio';
import { layoutChordBlock } from '@/engine/renderer/chordBlocks';
import { PITCH_GUTTER_WIDTH } from '@/engine/renderer/constants';
import { computeNoteBlockRect } from '@/engine/renderer/noteBlocks';
import { theoryEngine } from '@/engine/theory/theoryEngine';
import { resetPlaybackStoreForTests, usePlaybackStore } from '@/store/playbackStore';

const { toneStart, pianoStart } = vi.hoisted(() => ({
  toneStart: vi.fn<[], Promise<void>>(),
  pianoStart: vi.fn(),
}));

vi.mock('@/engine/audio/pianoSampleLoader', () => ({
  ensurePianoSamplesLoaded: vi.fn(() => Promise.resolve()),
  disposePianoSamples: vi.fn(),
  resetPianoSampleCacheForTests: vi.fn(),
  getPianoInstrument: vi.fn(() => ({
    start: (...args: unknown[]) => pianoStart(...args),
    disconnect: vi.fn(),
  })),
}));

vi.mock('tone', () => ({
  __esModule: true,
  start: () => toneStart(),
  now: () => 0,
  getContext: () => ({
    rawContext: {},
  }),
  getTransport: () => ({
    PPQ: 48,
    bpm: { value: 120 },
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
    ticks: 0,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
  }),
  Time: class {
    constructor(_expr: string) {}
    toSeconds() {
      return 0.1;
    }
  },
  Part: class {
    constructor(_fn: unknown, _events: unknown) {}
    start() {}
    stop() {}
    dispose() {}
  },
}));

const DEFAULT_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};

function mockCanvasLayout(rect: Partial<DOMRect> & Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>) {
  const full: DOMRect = {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    left: rect.left,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON() {
      return {};
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(full);
}

function canvasIn(container: HTMLElement): HTMLCanvasElement {
  const el = container.querySelector('canvas');
  if (!el) {
    throw new Error('Editor canvas not found in container');
  }
  return el as HTMLCanvasElement;
}

function stubCanvas2d() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId) => {
    if (contextId !== '2d') {
      return null;
    }
    return {
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      clip: vi.fn(),
      translate: vi.fn(),
      setTransform: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      arcTo: vi.fn(),
      roundRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  });
}

function makeSong(note: NoteEvent, chord: ChordEvent): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'Audition',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: randomUUID(),
        chords: [chord],
        notes: [[note], [], [], []],
      },
      ...Array.from({ length: 7 }, () => ({
        id: randomUUID(),
        chords: [],
        notes: [[], [], [], []] as [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]],
      })),
    ],
    bandConfig: {
      tracks: [
        { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
        { role: 'melody2', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
        { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
        { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
        { role: 'drums', instrument: 'piano', volume: 0.0, mute: true, octave: 0 },
      ],
    },
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

describe('OB-1 + OB-2 — note and chord click audition (PAT-026 gesture path)', () => {
  let noteId: string;
  let chordId: string;
  let note: NoteEvent;
  let chord: ChordEvent;
  let song: SongData;
  let initializeAudioSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    polyfillRaf();
    vi.clearAllMocks();
    toneStart.mockResolvedValue(undefined);
    resetPlaybackEngineForTests();
    resetPlaybackStoreForTests();
    stubCanvas2d();

    noteId = randomUUID();
    chordId = randomUUID();
    note = {
      id: noteId,
      scaleDegree: 3,
      octave: 0,
      chromatic: 0,
      beat: 48,
      duration: 24,
      isRest: false,
      velocity: 100,
    };
    chord = {
      id: chordId,
      scaleDegree: 1,
      quality: 'major',
      seventh: 'none',
      suspension: 'none',
      addition: 'none',
      inversion: 0,
      borrowed: null,
      secondary: null,
      beat: 0,
      duration: 96,
    };
    song = makeSong(note, chord);

    initializeAudioSpy = vi.spyOn(usePlaybackStore.getState(), 'initializeAudio');
  });

  afterEach(() => {
    initializeAudioSpy.mockRestore();
    cleanup();
  });

  describe('happy path', () => {
    it('calls initializeAudio and previews a single piano note when the user taps a melody note block (no drag)', async () => {
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      const nr = computeNoteBlockRect({
        song,
        viewport: DEFAULT_VIEWPORT,
        measureIndex: 0,
        note,
        isRest: false,
        voiceIndex: 0,
      });
      const vx = nr.x + nr.width / 2;
      const vy = nr.y + nr.height / 2;
      const clientX = PITCH_GUTTER_WIDTH + vx;
      const clientY = vy;

      const expectedMidi = theoryEngine.scaleDegreeToMidi(
        note.scaleDegree,
        note.octave,
        note.chromatic,
        song.metadata.key,
        song.metadata.scale,
        4,
      );

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);
      fireEvent.pointerDown(canvas, {
        clientX,
        clientY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX,
        clientY,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      await waitFor(() => {
        expect(initializeAudioSpy).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(pianoStart).toHaveBeenCalled();
      });

      expect(usePlaybackStore.getState().initStatus).toBe('ready');

      const first = pianoStart.mock.calls[0]?.[0] as { note?: number } | undefined;
      expect(first?.note).toBe(expectedMidi);
    });

    it('calls initializeAudio and previews every chord voicing MIDI note when the user taps a chord block', async () => {
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      const cr = layoutChordBlock(chord, 0, song, DEFAULT_VIEWPORT);
      const vx = cr.x + cr.width / 2;
      const vy = cr.y + cr.height / 2;
      const clientX = PITCH_GUTTER_WIDTH + vx;
      const clientY = vy;

      const step = buildHarmonyVoicingSequence(song).find(
        (s) => s.measureIndex === 0 && s.chord.id === chord.id,
      );
      expect(step).toBeDefined();
      const expectedMidis = [...step!.voicing.harmonyMidi, step!.voicing.bassMidi];

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);
      fireEvent.pointerDown(canvas, {
        clientX,
        clientY,
        button: 0,
        buttons: 1,
        pointerId: 2,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX,
        clientY,
        button: 0,
        buttons: 0,
        pointerId: 2,
        pointerType: 'mouse',
      });

      await waitFor(() => {
        expect(initializeAudioSpy).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(pianoStart.mock.calls.length).toBeGreaterThanOrEqual(expectedMidis.length);
      });

      expect(usePlaybackStore.getState().initStatus).toBe('ready');

      const played = pianoStart.mock.calls.map((c) => (c[0] as { note: number }).note);
      expect([...played].sort((a, b) => a - b)).toEqual([...expectedMidis].sort((a, b) => a - b));
    });
  });

  describe('PAT-026 — gesture init lifecycle with audition', () => {
    it('does not invoke engine.initialize more than once when two auditions run after audio is already ready', async () => {
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      const nr = computeNoteBlockRect({
        song,
        viewport: DEFAULT_VIEWPORT,
        measureIndex: 0,
        note,
        isRest: false,
        voiceIndex: 0,
      });
      const vx = nr.x + nr.width / 2;
      const vy = nr.y + nr.height / 2;
      const clientX = PITCH_GUTTER_WIDTH + vx;
      const clientY = vy;

      const engine = getPlaybackEngine();
      const engineInitSpy = vi.spyOn(engine, 'initialize');

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);
      const tap = () => {
        fireEvent.pointerDown(canvas, {
          clientX,
          clientY,
          button: 0,
          buttons: 1,
          pointerId: 3,
          pointerType: 'mouse',
        });
        fireEvent.pointerUp(canvas, {
          clientX,
          clientY,
          button: 0,
          buttons: 0,
          pointerId: 3,
          pointerType: 'mouse',
        });
      };

      tap();
      await waitFor(() => expect(usePlaybackStore.getState().initStatus).toBe('ready'));

      const countAfterFirst = engineInitSpy.mock.calls.length;
      expect(countAfterFirst).toBeGreaterThanOrEqual(1);

      tap();
      await waitFor(() => expect(pianoStart.mock.calls.length).toBeGreaterThanOrEqual(2));

      expect(engineInitSpy.mock.calls.length).toBe(countAfterFirst);
    });

    it('treats pointer movement below the drag threshold as a tap (audition), not a move drag', async () => {
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      const nr = computeNoteBlockRect({
        song,
        viewport: DEFAULT_VIEWPORT,
        measureIndex: 0,
        note,
        isRest: false,
        voiceIndex: 0,
      });
      const vx = nr.x + nr.width / 2;
      const vy = nr.y + nr.height / 2;
      const baseX = PITCH_GUTTER_WIDTH + vx;
      const baseY = vy;

      const onNoteEdit = vi.fn();

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={DEFAULT_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={onNoteEdit}
          onSelectionChange={vi.fn()}
          onViewportChange={vi.fn()}
        />,
      );

      const canvas = canvasIn(container);
      fireEvent.pointerDown(canvas, {
        clientX: baseX,
        clientY: baseY,
        button: 0,
        buttons: 1,
        pointerId: 4,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvas, {
        clientX: baseX + DRAG_THRESHOLD_PX - 1,
        clientY: baseY,
        button: 0,
        buttons: 1,
        pointerId: 4,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvas, {
        clientX: baseX + DRAG_THRESHOLD_PX - 1,
        clientY: baseY,
        button: 0,
        buttons: 0,
        pointerId: 4,
        pointerType: 'mouse',
      });

      await waitFor(() => {
        expect(initializeAudioSpy).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(pianoStart).toHaveBeenCalled();
      });

      const moveOrResize = onNoteEdit.mock.calls.filter(
        ([, , ev]) => ev.type === 'move' || ev.type === 'resize',
      );
      expect(moveOrResize.length).toBe(0);
    });
  });
});
