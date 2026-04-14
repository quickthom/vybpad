/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — TASK-5.1
 *
 * Criterion 1 — INTERFACES `ChordPaletteProps` + `mode: "diatonic"`: `onChordSelect` emits
 *   `Omit<ChordEvent, "id" | "beat" | "duration">` with borrowed/secondary null, inversion 0,
 *   suspension/addition none, quality/seventh from diatonic theory (same as keyboard factory).
 *   happy: degree click yields expected omit for C major (spot-check + one secondary scale).
 *   error: non-diatonic modes are out of scope for this criterion (Builder may no-op or differ).
 *   edges: degree VII in major (leading-tone quality), mode with different scale at measure (if surfaced via props).
 *
 * Criterion 2 — UX_GUIDELINES §7: left chord palette region has accessible name, interactive degree
 *   controls are focusable, default width uses 288px layout token (class or inline).
 *   happy: region role + name; at least seven degree targets; width token present.
 *   error: missing region or unnamed region fails.
 *   edges: (none beyond contract)
 *
 * Criterion 3 — Placement parity with keyboard digit entry: same initial song + selection + duration,
 *   palette degree click produces the same `ChordEditAction` add payload as `handleEditorKeydown`
 *   for the matching digit (oracle: `buildDiatonicChordPayload` / `handleEditorKeydown` path).
 *   happy: table-mode collapsed range caret, empty measure — compare add chord payloads.
 *   error: (covered by mismatch assertion).
 *   edges: append after existing chord (next beat) still matches keyboard.
 */

import { ChordPalette } from '@/components/panels/ChordPalette';
import type { ComponentProps } from 'react';
import {
  buildDiatonicChordPayload,
  clampDurationToMeasure,
  nextAppendBeat,
  resolveMeasureIndexForKeyboardDigit,
} from '@/components/editor/editorKeyboardLogic';
import { handleEditorKeydown, type EditorKeyboardContext } from '@/hooks/useKeyboard';
import type { ChordEditAction, ChordEvent, ScaleDegree, Selection, SongData, Viewport } from '@vybpad/shared';
import { buildDefaultSong } from '@/store/songStore';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const viewport: Viewport = { startMeasure: 0, measureCount: 8, scrollY: 0, zoom: 1 };

/** Mirrors `useKeyboard` placement for chord append (TASK-5.1 parity with digit entry). */
function chordAppendBeat(
  selection: Selection | null,
  song: SongData,
  measureIndex: number,
  voice: 0 | 1 | 2 | 3,
): number | null {
  if (
    selection?.type === 'range' &&
    selection.rangeStart === selection.rangeEnd &&
    selection.measureIndex === measureIndex
  ) {
    return Math.round(selection.rangeStart ?? 0);
  }
  return nextAppendBeat(song, measureIndex, 'chord', voice);
}

function diatonicOmitFromPayload(song: SongData, measureIndex: number, degree: ScaleDegree): Omit<
  ChordEvent,
  'id' | 'beat' | 'duration'
> {
  const full = buildDiatonicChordPayload(song, measureIndex, degree, 0, 48);
  const { beat: _b, duration: _d, ...rest } = full;
  return rest;
}

function defaultChordPaletteProps(
  overrides: Partial<ComponentProps<typeof ChordPalette>> = {},
): ComponentProps<typeof ChordPalette> {
  return {
    currentKey: 'C',
    currentScale: 'major',
    mode: 'diatonic',
    onChordSelect: vi.fn(),
    ...overrides,
  };
}

describe('ChordPalette — TASK-5.1 — diatonic ChordPaletteProps / Omit<ChordEvent,…> defaults', () => {
  describe('happy path', () => {
    it('invokes onChordSelect with diatonic theory fields (quality, seventh) and borrowed/secondary null, inversion 0 for degree IV in C major', async () => {
      const user = userEvent.setup();
      const onChordSelect = vi.fn();
      const song = buildDefaultSong();
      render(<ChordPalette {...defaultChordPaletteProps({ onChordSelect })} />);

      const btn = screen.getByTestId('chord-palette-degree-4');
      await user.click(btn);

      expect(onChordSelect).toHaveBeenCalledTimes(1);
      const expected = diatonicOmitFromPayload(song, 0, 4);
      expect(onChordSelect.mock.calls[0][0]).toEqual(expected);
    });

    it('matches diatonic omit for degree VII (leading tone) in C major', async () => {
      const user = userEvent.setup();
      const onChordSelect = vi.fn();
      const song = buildDefaultSong();
      render(<ChordPalette {...defaultChordPaletteProps({ onChordSelect })} />);

      await user.click(screen.getByTestId('chord-palette-degree-7'));

      const expected = diatonicOmitFromPayload(song, 0, 7);
      expect(onChordSelect.mock.calls[0][0]).toEqual(expected);
    });
  });

  describe('edge cases', () => {
    it('uses currentKey/currentScale for theory when props use A minor natural', async () => {
      const user = userEvent.setup();
      const onChordSelect = vi.fn();
      const song = buildDefaultSong();
      const am = structuredClone(song);
      am.metadata.key = 'A';
      am.metadata.scale = 'minor';

      render(
        <ChordPalette
          {...defaultChordPaletteProps({
            currentKey: 'A',
            currentScale: 'minor',
            onChordSelect,
          })}
        />,
      );

      await user.click(screen.getByTestId('chord-palette-degree-1'));

      const expected = diatonicOmitFromPayload(am, 0, 1);
      expect(onChordSelect.mock.calls[0][0]).toEqual(expected);
    });
  });
});

describe('ChordPalette — TASK-5.1 — left panel region, focusable controls, 288px width (UX §7)', () => {
  describe('happy path', () => {
    it('exposes a named region and at least seven focusable degree controls', () => {
      render(<ChordPalette {...defaultChordPaletteProps()} />);

      const region = screen.getByRole('region', { name: /chord palette/i });
      expect(region).toBeTruthy();

      for (const d of [1, 2, 3, 4, 5, 6, 7] as const) {
        const el = screen.getByTestId(`chord-palette-degree-${d}`);
        expect(el.tabIndex).toBeGreaterThanOrEqual(0);
        expect(el.getAttribute('tabindex')).not.toBe('-1');
      }
    });

    it('applies the 288px default panel width token on the palette root', () => {
      render(<ChordPalette {...defaultChordPaletteProps()} />);
      const root = screen.getByTestId('chord-palette-root');
      const cls = root.getAttribute('class') ?? '';
      const style = root.getAttribute('style') ?? '';
      const token =
        /\b(?:w-\[288px\]|w-72|min-w-\[288px\])\b/.test(cls) ||
        /\b288px\b/.test(style) ||
        root.classList.contains('w-72');
      expect(token).toBe(true);
    });
  });
});

describe('ChordPalette — TASK-5.1 — placement parity with keyboard digit (buildDiatonicChordPayload / measure-beat)', () => {
  function makeKeyboardContext(opts: {
    song: SongData;
    selection: Selection | null;
    onChordEdit: (measureIndex: number, action: ChordEditAction) => void;
  }): EditorKeyboardContext {
    const keyboardTargetMeasureRef = { current: null as number | null };
    const textDurationArmedRef = { current: false };
    return {
      song: opts.song,
      viewport,
      selection: opts.selection,
      activeVoice: 0,
      entryMode: 'table',
      currentDurationTicks: 48,
      setCurrentDurationTicks: vi.fn(),
      keyboardTargetMeasureRef,
      textDurationArmedRef,
      getSongAfterMutation: () => opts.song,
      getSelectionAfterMutation: () => opts.selection,
      onChordEdit: opts.onChordEdit,
      onNoteEdit: vi.fn(),
      onSelectionChange: vi.fn(),
    };
  }

  /** Parent wiring expected for palette: same append beat + duration resolution as digit path. */
  function PaletteHost(props: {
    song: SongData;
    selection: Selection | null;
    onChordEdit: (measureIndex: number, action: ChordEditAction) => void;
  }) {
    const measureIndex = resolveMeasureIndexForKeyboardDigit(
      props.selection,
      viewport,
      props.song,
      { current: null },
    );
    const handleSelect = (omit: Omit<ChordEvent, 'id' | 'beat' | 'duration'>) => {
      const nb = chordAppendBeat(props.selection, props.song, measureIndex, 0);
      if (nb == null) return;
      const dur = clampDurationToMeasure(props.song, measureIndex, nb, 48);
      const chord = buildDiatonicChordPayload(props.song, measureIndex, omit.scaleDegree, nb, dur);
      props.onChordEdit(measureIndex, { type: 'add', chord });
    };

    return (
      <ChordPalette
        currentKey={props.song.metadata.key}
        currentScale={props.song.metadata.scale}
        mode="diatonic"
        onChordSelect={handleSelect}
      />
    );
  }

  it('produces the same chord add payload as handleEditorKeydown for the same degree (empty measure, caret at 0)', async () => {
    const user = userEvent.setup();
    const song = buildDefaultSong();
    const selection: Selection = { type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 };

    const onKb = vi.fn();
    handleEditorKeydown(new KeyboardEvent('keydown', { key: '5', bubbles: true }), makeKeyboardContext({ song, selection, onChordEdit: onKb }));
    const keyboardAction = onKb.mock.calls[0]?.[1];
    expect(keyboardAction).toEqual(expect.objectContaining({ type: 'add' }));

    const onPal = vi.fn();
    render(<PaletteHost song={song} selection={selection} onChordEdit={onPal} />);
    await user.click(screen.getByTestId('chord-palette-degree-5'));

    expect(onPal.mock.calls[0]?.[1]).toEqual(keyboardAction);
  });

  it('matches keyboard placement when appending after an existing chord in the measure', async () => {
    const user = userEvent.setup();
    const song = buildDefaultSong();
    song.measures[0].chords.push({
      id: 'existing-chord',
      scaleDegree: 1,
      quality: 'major',
      seventh: 'maj7',
      suspension: 'none',
      addition: 'none',
      inversion: 0,
      borrowed: null,
      secondary: null,
      beat: 0,
      duration: 48,
    });
    const selection: Selection = { type: 'range', measureIndex: 0, rangeStart: 48, rangeEnd: 48 };

    const onKb = vi.fn();
    handleEditorKeydown(new KeyboardEvent('keydown', { key: '2', bubbles: true }), makeKeyboardContext({ song, selection, onChordEdit: onKb }));
    const keyboardAction = onKb.mock.calls[0]?.[1];

    const onPal = vi.fn();
    render(<PaletteHost song={song} selection={selection} onChordEdit={onPal} />);
    await user.click(screen.getByTestId('chord-palette-degree-2'));

    expect(onPal.mock.calls[0]?.[1]).toEqual(keyboardAction);
  });
});
