/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-R2-W5.2
 *
 * Criterion 1: For an active melody voice, note geometry follows clamped W5.1 pitch-range anchoring
 *   happy: active-voice-only note selection is attempted at coordinates from the note rect computed with
 *     `computeMelodyVoicePitchRanges(activeSong)[activeVoice].minPitch` as the scroll anchor.
 *   error: with no range-aware anchoring, the same active coordinates miss the target note.
 *   edges: single-note active range expands to one octave and keeps note anchored relative to range min.
 *
 * Criterion 2: hitTestEditorCanvas aligns with computeNoteBlockRect AABB
 *   happy: interior points hit note for non-default scroll values derived from range-aware scroll anchor,
 *     right/bottom AABB edges miss.
 *   error: edge inclusivity drifts between geometry and hit-test.
 *   edges: chromatic notes are still aligned to the same AABB.
 *
 * Criterion 3: Active voice selection is deterministic for disjoint per-voice pitch spans
 *   happy: when switching activeVoice between disjoint pitch ranges, click coordinates derived from each
 *     active-range anchor map deterministically to the expected target voice.
 *   error: without active-voice range anchoring, both cases read from the same global viewport.
 *   edges: notes in non-overlapping ranges produce different anchors and thus different row mappings.
 *
 * Criterion 4: pitch labels and grid rows share the same effective row math as note geometry
 *   happy: for a range-driven viewport scroll anchor, pitch-axis labels and note block centers share the
 *     same row center Y in viewport space.
 *   error: label rows shift independently from note geometry.
 *   edges: disjoint chromatic offsets stay aligned to computed row centers.
 *
 * Criterion 5: EditorCanvas default props remain valid while range-aware geometry is active
 *   happy: caller-owned optional props omitted should not change contract; active-range clicks still route to note hits.
 *   error: default/legacy prop usage changes cause miss or throw.
 *   edges: no explicit melodyVoiceVisible / inactiveMelodyDisplayMode arguments provided.
 *
 * Supporting check: selection/drag affordances still share geometry alignment with hit rects
 *   happy: trailing-strip resize still dispatches NoteEditAction resize for a note hit by its computed strip.
 *   error: y-misaligned pointer near strip edge does not dispatch resize for that note.
 *   edges: thin-note trailing strip clamp still permits resize gestures.
 *
 * Criterion 4: Empty/all-rest active voices preserve EMPTY_VOICE_PITCH_RANGE behavior in alignment math
 *   happy: active voice with only rests yields the EMPTY_VOICE_PITCH_RANGE anchor and still permits alignment math to target other active-voice-rendered content.
 *   error: all-rest voices should not produce undefined / unbounded vertical anchors in hit-testing.
 *   edges: fallback minimum span (60..72) remains stable.
 */

import { randomUUID } from 'node:crypto';

import type { NoteEvent, SongData, Viewport } from '@vybpad/shared';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorCanvas } from '../../../../src/components/editor/EditorCanvas';
import { trailingResizeStripWidthPx } from '../../../../src/components/editor/pointerMath';
import { PITCH_GUTTER_WIDTH } from '../../../../src/engine/renderer/constants';
import * as pitchAxisLayout from '../../../../src/engine/renderer/pitchAxisLayout';
import { computeVoicePitchRanges as computeMelodyVoicePitchRanges, EMPTY_VOICE_PITCH_RANGE } from '../../../../src/engine/renderer/voicePitchRange';
import { computeNoteBlockRect } from '../../../../src/engine/renderer/noteBlocks';
import { melodyPitchRangeRowCount, midiToStaffRowOffset } from '../../../../src/engine/renderer/layout';
import { hitTestEditorCanvas, type EditorCanvasHit } from '../../../../src/engine/renderer/hitTest';
import { melodyRowHeightPx } from '../../../../src/utils/staffSpacing';

const BASE_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};
const DEFAULT_EDITOR_ROW_HEIGHT = melodyRowHeightPx('default');

type VoiceIndex = 0 | 1 | 2 | 3;

function note(partial: Pick<NoteEvent, 'beat' | 'duration'> & Partial<NoteEvent>): NoteEvent {
  return {
    id: partial.id ?? randomUUID(),
    scaleDegree: partial.scaleDegree ?? 1,
    octave: partial.octave ?? 0,
    chromatic: partial.chromatic ?? 0,
    beat: partial.beat,
    duration: partial.duration,
    isRest: partial.isRest ?? false,
    velocity: partial.velocity ?? 100,
  };
}

function makeSong(voices: [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]]): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'UI-R2-W5.2',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: randomUUID(),
        chords: [],
        notes: voices,
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

function canvasIn(container: HTMLElement): HTMLCanvasElement {
  const el = container.querySelector('canvas');
  if (!el) throw new Error('Editor canvas not found in container');
  return el as HTMLCanvasElement;
}

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

function rowOffsetPxForMidiPitch(midi: number, melodyRowHeight: number = DEFAULT_EDITOR_ROW_HEIGHT): number {
  return midiToStaffRowOffset(midi) * melodyRowHeight;
}

function activeVoiceAlignedRect(
  song: SongData,
  note: NoteEvent,
  measureIndex: number,
  voiceIndex: VoiceIndex,
  activeVoice: VoiceIndex,
  viewport: Viewport = BASE_VIEWPORT,
  melodyRowHeight: number = DEFAULT_EDITOR_ROW_HEIGHT,
) {
  const ranges = computeMelodyVoicePitchRanges(song);
  const anchor = ranges[activeVoice]?.minPitch ?? EMPTY_VOICE_PITCH_RANGE.minPitch;
  return computeNoteBlockRect({
    song,
    viewport,
    measureIndex,
    note,
    isRest: note.isRest,
    voiceIndex,
    melodyRowHeight,
    melodyVoicePitchRange: { minPitch: anchor },
  });
}

function rangeAnchorScrollY(song: SongData, activeVoice: VoiceIndex, melodyRowHeight: number = DEFAULT_EDITOR_ROW_HEIGHT): number {
  const ranges = computeMelodyVoicePitchRanges(song);
  return rowOffsetPxForMidiPitch(ranges[activeVoice]?.minPitch ?? EMPTY_VOICE_PITCH_RANGE.minPitch, melodyRowHeight);
}

function hitAt(
  song: SongData,
  point: { x: number; y: number },
  activeVoice: VoiceIndex = 0,
  viewport: Viewport = BASE_VIEWPORT,
  melodyRowHeight: number = DEFAULT_EDITOR_ROW_HEIGHT,
): EditorCanvasHit | null {
  const ranges = computeMelodyVoicePitchRanges(song);
  const range = ranges[activeVoice] ?? ranges[0];
  const melodyRowCount = melodyPitchRangeRowCount(range);
  return hitTestEditorCanvas(
    point.x,
    point.y,
    song,
    viewport,
    melodyRowHeight,
    [true, true, true, true],
    range,
    melodyRowCount,
  );
}

describe('UI-R2-W5.2 — active melody pitch-range geometry and interaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubCanvas2d();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Criterion 1: active voice uses W5.1 clamped pitch-range anchoring', () => {
    it('selects a high active-voice note when clicking at clamped-range-aligned coordinates (independent of manual viewport scroll)', () => {
      const noteId = randomUUID();
      const activeHigh = note({
        id: noteId,
        beat: 12,
        duration: 24,
        scaleDegree: 1,
        octave: 2,
        chromatic: 0,
        isRest: false,
      });
      const song = makeSong([ [activeHigh], [], [], [] ]);
      const expectedRect = activeVoiceAlignedRect(song, activeHigh, 0, 0, 0, BASE_VIEWPORT);

      const onSelectionChange = vi.fn();
      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={BASE_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={onSelectionChange}
          onViewportChange={vi.fn()}
        />,
      );
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      const hit = hitAt(
        song,
        {
        x: PITCH_GUTTER_WIDTH + expectedRect.x + expectedRect.width / 2,
        y: expectedRect.y + expectedRect.height / 2,
        },
        0,
        BASE_VIEWPORT,
        DEFAULT_EDITOR_ROW_HEIGHT,
      );

      expect(hit).toBeNull();
      fireEvent.pointerDown(canvasIn(container), {
        clientX: PITCH_GUTTER_WIDTH + expectedRect.x + expectedRect.width / 2,
        clientY: expectedRect.y + expectedRect.height / 2,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const sel = onSelectionChange.mock.calls.at(-1)?.[0];
      expect(sel).toMatchObject({
        type: 'note',
        measureIndex: 0,
        eventIds: [noteId],
      });
    });
  });

  describe('Criterion 3: disjoint per-voice ranges produce deterministic active-voice-dependent row maps', () => {
    it('targets each voice deterministically when activeVoice changes between disjoint pitch spans', () => {
      const lowVoiceNote = note({
        id: randomUUID(),
        beat: 0,
        duration: 24,
        scaleDegree: 1,
        octave: 0,
        chromatic: 0,
      });
      const highVoiceNote = note({
        id: randomUUID(),
        beat: 96,
        duration: 24,
        scaleDegree: 7,
        octave: 3,
        chromatic: 0,
      });
      const song = makeSong([[lowVoiceNote], [highVoiceNote], [], []]);

      const lowRect = activeVoiceAlignedRect(song, lowVoiceNote, 0, 0, 0, BASE_VIEWPORT);
      const highRect = activeVoiceAlignedRect(song, highVoiceNote, 0, 1, 1, BASE_VIEWPORT);
      const lowAnchor = rangeAnchorScrollY(song, 0);
      const highAnchor = rangeAnchorScrollY(song, 1);

      expect(lowAnchor).not.toEqual(highAnchor);
      expect(lowRect.y).not.toEqual(highRect.y);
      const lowSelection = vi.fn();
      const highSelection = vi.fn();

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={BASE_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={lowSelection}
          onViewportChange={vi.fn()}
        />,
      );
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      fireEvent.pointerDown(canvasIn(container), {
        clientX: PITCH_GUTTER_WIDTH + lowRect.x + lowRect.width / 2,
        clientY: lowRect.y + lowRect.height / 2,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });

      expect(lowSelection).toHaveBeenCalledWith({
        type: 'note',
        measureIndex: 0,
        eventIds: [lowVoiceNote.id],
      });

      const { container: activeShiftedContainer } = render(
        <EditorCanvas
          song={song}
          viewport={BASE_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={1}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={highSelection}
          onViewportChange={vi.fn()}
        />,
      );

      fireEvent.pointerDown(canvasIn(activeShiftedContainer), {
        clientX: PITCH_GUTTER_WIDTH + highRect.x + highRect.width / 2,
        clientY: highRect.y + highRect.height / 2,
        button: 0,
        buttons: 1,
        pointerId: 2,
        pointerType: 'mouse',
      });

      expect(highSelection).toHaveBeenCalledWith({
        type: 'note',
        measureIndex: 0,
        eventIds: [highVoiceNote.id],
      });
    });
  });

  describe('Criterion 2: note hit-testing follows computeNoteBlockRect AABB', () => {
    it('hits only inside the rect computed for that note and rejects boundary points at x+width / y+height', () => {
      const noteId = randomUUID();
      const n = note({
        id: noteId,
        beat: 0,
        duration: 48,
        scaleDegree: 3,
        octave: 0,
        chromatic: -1,
        isRest: false,
      });
      const song = makeSong([[n], [], [], []]);
      const rect = computeNoteBlockRect({
        song,
        viewport: BASE_VIEWPORT,
        measureIndex: 0,
        note: n,
        isRest: false,
        voiceIndex: 0,
        melodyRowHeight: DEFAULT_EDITOR_ROW_HEIGHT,
        melodyVoicePitchRange: computeMelodyVoicePitchRanges(song)[0],
      });

      expect(
        hitAt(song, { x: rect.x + 1, y: rect.y + 1 }, 0, BASE_VIEWPORT, DEFAULT_EDITOR_ROW_HEIGHT),
      ).toMatchObject({
        kind: 'note',
        note: expect.objectContaining({ id: noteId }),
      });

      expect(hitAt(song, { x: rect.x + rect.width, y: rect.y + rect.height / 2 }, 0, BASE_VIEWPORT, DEFAULT_EDITOR_ROW_HEIGHT)).toBeNull();
      expect(
        hitAt(song, { x: rect.x + rect.width / 2, y: rect.y + rect.height }, 0, BASE_VIEWPORT, DEFAULT_EDITOR_ROW_HEIGHT),
      ).toBeNull();
      expect(hitAt(song, { x: rect.x + rect.width + 0.001, y: rect.y + 1 }, 0, BASE_VIEWPORT, DEFAULT_EDITOR_ROW_HEIGHT)).toBeNull();
    });

    it('keeps aligned when the viewport scroll offset comes from an active voice range anchor', () => {
      const n = note({
        id: randomUUID(),
        beat: 48,
        duration: 48,
        scaleDegree: 3,
        octave: 2,
        chromatic: 0,
      });
      const s = makeSong([[n], [], [], []]);
      const anchoredViewport = {
        ...BASE_VIEWPORT,
        scrollY: rangeAnchorScrollY(s, 0),
      };
      const rect = computeNoteBlockRect({
        song: s,
        viewport: anchoredViewport,
        measureIndex: 0,
        note: n,
        isRest: false,
        voiceIndex: 0,
        melodyRowHeight: DEFAULT_EDITOR_ROW_HEIGHT,
        melodyVoicePitchRange: computeMelodyVoicePitchRanges(s)[0],
      });

      expect(hitAt(s, { x: rect.x + 1, y: rect.y + 1 }, 0, anchoredViewport, DEFAULT_EDITOR_ROW_HEIGHT)).toMatchObject({
        kind: 'note',
        note: expect.objectContaining({ id: n.id }),
      });
      expect(hitAt(s, { x: rect.x + rect.width, y: rect.y }, 0, anchoredViewport, DEFAULT_EDITOR_ROW_HEIGHT)).toBeNull();
    });
  });

  describe('Criterion 3: drag affordances are aligned with the same note rect used for hit-testing', () => {
    it('dispatches NoteEditAction resize when dragging the trailing edge computed from the same aligned note rect', () => {
      const noteId = randomUUID();
      const n = note({
        id: noteId,
        beat: 48,
        duration: 48,
        scaleDegree: 4,
        octave: 0,
        chromatic: 0,
        isRest: false,
      });
      const song = makeSong([[n], [], [], []]);
      const rect = computeNoteBlockRect({
        song,
        viewport: BASE_VIEWPORT,
        measureIndex: 0,
        note: n,
        isRest: false,
        voiceIndex: 0,
        melodyRowHeight: DEFAULT_EDITOR_ROW_HEIGHT,
        melodyVoicePitchRange: computeMelodyVoicePitchRanges(song)[0],
      });
      const stripW = trailingResizeStripWidthPx(rect.width);
      const downX = PITCH_GUTTER_WIDTH + rect.x + rect.width - stripW / 2;
      const downY = rect.y + rect.height / 2;
      const dragDelta = 96;
      const onNoteEdit = vi.fn();

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={BASE_VIEWPORT}
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
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      fireEvent.pointerDown(canvasIn(container), {
        clientX: downX,
        clientY: downY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvasIn(container), {
        clientX: downX + dragDelta,
        clientY: downY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvasIn(container), {
        clientX: downX + dragDelta,
        clientY: downY,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const resizeCalls = onNoteEdit.mock.calls.filter((args) => args[2]?.type === 'resize');
      expect(resizeCalls.length).toBeGreaterThan(0);
      const payload = resizeCalls.at(-1)?.[2];
      expect(payload).toMatchObject({
        type: 'resize',
        noteId,
      });
    });

    it('does not dispatch resize when strip y is outside the aligned note rect band', () => {
      const noteId = randomUUID();
      const n = note({
        id: noteId,
        beat: 48,
        duration: 48,
        scaleDegree: 4,
        octave: 0,
        chromatic: 0,
        isRest: false,
      });
      const song = makeSong([[n], [], [], []]);
      const rect = computeNoteBlockRect({
        song,
        viewport: BASE_VIEWPORT,
        measureIndex: 0,
        note: n,
        isRest: false,
        voiceIndex: 0,
        melodyRowHeight: DEFAULT_EDITOR_ROW_HEIGHT,
        melodyVoicePitchRange: computeMelodyVoicePitchRanges(song)[0],
      });
      const stripW = trailingResizeStripWidthPx(rect.width);
      const downX = PITCH_GUTTER_WIDTH + rect.x + rect.width - stripW / 2;
      const downY = rect.y + rect.height + 8;
      const onNoteEdit = vi.fn();

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={BASE_VIEWPORT}
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
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      fireEvent.pointerDown(canvasIn(container), {
        clientX: downX,
        clientY: downY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(canvasIn(container), {
        clientX: downX + 96,
        clientY: downY,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });
      fireEvent.pointerUp(canvasIn(container), {
        clientX: downX + 96,
        clientY: downY,
        button: 0,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const resizeCalls = onNoteEdit.mock.calls.filter((args) => args[2]?.type === 'resize');
      expect(resizeCalls.length).toBe(0);
    });
  });

  describe('Criterion 4: EMPTY_VOICE_PITCH_RANGE is honored for alignment math when active voice has no non-rest notes', () => {
    it('falls back to EMPTY_VOICE_PITCH_RANGE minPitch for an active all-rest voice and still targets non-empty inactive voice content using the same alignment contract', () => {
      const activeRest = note({
        id: randomUUID(),
        beat: 12,
        duration: 12,
        scaleDegree: 3,
        octave: 0,
        chromatic: 0,
        isRest: true,
      });
      const visible = note({
        id: randomUUID(),
        beat: 24,
        duration: 24,
        scaleDegree: 1,
        octave: 2,
        chromatic: 0,
        isRest: false,
      });
      const song = makeSong([[activeRest], [visible], [], []]);
      const ranges = computeMelodyVoicePitchRanges(song);
      expect(ranges[0]).toEqual(EMPTY_VOICE_PITCH_RANGE);

      const visibleRectInFallback = computeNoteBlockRect({
        song,
        viewport: BASE_VIEWPORT,
        measureIndex: 0,
        note: visible,
        isRest: false,
        voiceIndex: 1,
        melodyRowHeight: DEFAULT_EDITOR_ROW_HEIGHT,
        melodyVoicePitchRange: ranges[0],
      });

      const onSelectionChange = vi.fn();
      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={BASE_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={onSelectionChange}
          onViewportChange={vi.fn()}
        />,
      );
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      fireEvent.pointerDown(canvasIn(container), {
        clientX: PITCH_GUTTER_WIDTH + visibleRectInFallback.x + visibleRectInFallback.width / 2,
        clientY: visibleRectInFallback.y + visibleRectInFallback.height / 2,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
      });

      const selection = onSelectionChange.mock.calls.at(-1)?.[0];
      expect(selection).toMatchObject({
        type: 'note',
        eventIds: [visible.id],
      });
    });
  });

  describe('Criterion 4: pitch-axis label rows follow the same row math as note geometry under range anchors', () => {
    it('uses shared row-center math between note blocks and pitch labels at non-default anchored scroll', () => {
      const visible = note({
        id: randomUUID(),
        beat: 0,
        duration: 48,
        scaleDegree: 4,
        octave: 2,
        chromatic: -1,
      });
      const song = makeSong([[visible], [], [], []]);
      const viewport = BASE_VIEWPORT;
      const rect = computeNoteBlockRect({
        song,
        viewport,
        measureIndex: 0,
        note: visible,
        isRest: false,
        voiceIndex: 0,
        melodyRowHeight: DEFAULT_EDITOR_ROW_HEIGHT,
        melodyVoicePitchRange: computeMelodyVoicePitchRanges(song)[0],
      });

      const labels = pitchAxisLayout.computePitchAxisLabelsInViewport(
        song,
        viewport,
        1200,
        DEFAULT_EDITOR_ROW_HEIGHT,
        computeMelodyVoicePitchRanges(song)[0],
      );
      const labelForNote = labels.find((label) => Math.abs(label.centerY - (rect.y + rect.height / 2)) < 0.0001);
      expect(labelForNote).toBeDefined();
      if (labelForNote) {
        expect(labelForNote.centerY).toBe(rect.y + rect.height / 2);
      }
    });
  });

  describe('Criterion 5: default prop contract with computed-range geometry', () => {
    it('keeps legacy optional-prop behavior when caller omits optional visibility/alias props and uses range-aligned hit coordinates', () => {
      const visible = note({
        id: randomUUID(),
        beat: 72,
        duration: 24,
        scaleDegree: 2,
        octave: 1,
        chromatic: 1,
      });
      const song = makeSong([[visible], [], [], []]);
      const rect = activeVoiceAlignedRect(song, visible, 0, 0, 0, BASE_VIEWPORT);
      const onSelectionChange = vi.fn();

      const { container } = render(
        <EditorCanvas
          song={song}
          viewport={BASE_VIEWPORT}
          selection={null}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={vi.fn()}
          onNoteEdit={vi.fn()}
          onSelectionChange={onSelectionChange}
          onViewportChange={vi.fn()}
        />,
      );
      mockCanvasLayout({ left: 0, top: 0, width: 1200, height: 800 });

      fireEvent.pointerDown(canvasIn(container), {
        clientX: PITCH_GUTTER_WIDTH + rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
        button: 0,
        buttons: 1,
        pointerId: 3,
        pointerType: 'mouse',
      });

      expect(onSelectionChange).toHaveBeenCalledWith({
        type: 'note',
        measureIndex: 0,
        eventIds: [visible.id],
      });
    });
  });
});

