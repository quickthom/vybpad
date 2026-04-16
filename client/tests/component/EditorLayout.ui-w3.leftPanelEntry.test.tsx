/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — UI-W3 (RA-5 duration + RA-6 left-panel melody entry)
 *
 * Criterion 1 — Left-panel placement duration updates subsequent note/chord length:
 *   happy: user sets duration (ticks) in left panel, next palette/chord placement uses that duration
 *   error: (deferred — invalid duration clamping is store/renderer; panel should not emit out-of-range)
 *   edges: at least two tick presets (e.g. 48 vs 96) produce different placed durations
 *
 * Criterion 2 — Pitch row + rest, Chromatic, Raise/Lower match keyboard-driven mutations where comparable:
 *   happy: melody pitch click produces same NoteEdit outcome as digit key for same scale degree (table mode)
 *   error: (focus/modal guards — covered elsewhere)
 *   edges: rest button; chromatic toggle aria-pressed; raise/lower adjust chromatic on selected note
 *
 * Criterion 3 — No regression to ChordPalette diatonic/borrowed:
 *   happy: mode tabs + borrowed scale select + degree clicks still add chords with expected borrowed flag
 *   error: borrowed tab shows no rows — skip click (documented in test body)
 *
 * Builder contract — stable `data-testid`s (left panel / melody entry region):
 * - `left-panel-duration-ticks-96` — sets shared placement duration to 96 ticks (half note, PAT-004)
 * - `left-panel-duration-ticks-48` — sets placement duration to 48 ticks (quarter)
 * - `melody-entry-pitch-E` — inserts / arms degree 3 in C major (same as keyboard `3` in note-entry context)
 * - `melody-entry-rest` — rest entry (isRest: true per INTERFACES NoteEvent)
 * - `melody-entry-chromatic-toggle` — toggle alternate spelling / chromatic rows (PAT-018); must expose `aria-pressed`
 * - `melody-entry-raise-half` / `melody-entry-lower-half` — nudge chromatic offset on selection (−1 / +1 semitone vs diatonic)
 *
 * ⛔ INTERFACES: Do not require new `NoteEditAction` discriminants — existing `add` / `update` with Partial<NoteEvent> suffice.
 */

import { randomUUID } from 'node:crypto';

import type { ChordEvent, NoteEvent, SongData } from '@vybpad/shared';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorLayout } from '@/app/EditorLayout';
import { type EditorKeyboardContext, handleEditorKeydown } from '@/hooks/useKeyboard';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useUIStore } from '@/store/uiStore';

const DEFAULT_VIEWPORT = { startMeasure: 0, measureCount: 8, scrollY: 0, zoom: 1 } as const;

/** Oracle: same note-append path as grid keyboard (`handleEditorKeydown` digit in note-entry context). */
function noteListAfterKeyboardDigit3(song: SongData, noteId: string): NoteEvent[] {
  useSongStore.getState().loadSong(song);
  const keyboardTargetMeasureRef = { current: null as number | null };
  const textDurationArmedRef = { current: false };
  const ctx: EditorKeyboardContext = {
    song: useSongStore.getState().song,
    viewport: { ...DEFAULT_VIEWPORT },
    selection: { type: 'note', measureIndex: 0, eventIds: [noteId] },
    activeVoice: 0,
    setActiveVoice: vi.fn(),
    entryMode: 'table',
    currentDurationTicks: 48,
    setCurrentDurationTicks: vi.fn(),
    keyboardTargetMeasureRef,
    textDurationArmedRef,
    getSongAfterMutation: () => useSongStore.getState().song,
    getSelectionAfterMutation: () => ({ type: 'note', measureIndex: 0, eventIds: [noteId] }),
    onChordEdit: vi.fn(),
    onNoteEdit: (mi, v, a) => useSongStore.getState().editNote(mi, v, a),
    onSelectionChange: (s) => useUIStore.getState().setSelection(s),
  };
  handleEditorKeydown(new KeyboardEvent('keydown', { key: '3', bubbles: true, cancelable: true }), ctx);
  return structuredClone(useSongStore.getState().song.measures[0]!.notes[0]);
}

function stubCanvas2d(): void {
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

function renderEditorAtLocalEditor(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/editor']}>
      <Routes>
        <Route path="/editor" element={<EditorLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

function chordEvent(
  id: string,
  beat: number,
  duration: number,
  scaleDegree: ChordEvent['scaleDegree'] = 1,
): ChordEvent {
  return {
    id,
    scaleDegree,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat,
    duration,
  };
}

/** Compare placement semantics without unstable `id` values from `crypto.randomUUID()`. */
function notesEqualSansIds(a: NoteEvent[], b: NoteEvent[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) return false;
    const { id: _ix, ...xr } = x;
    const { id: _iy, ...yr } = y;
    if (JSON.stringify(xr) !== JSON.stringify(yr)) return false;
  }
  return true;
}

function noteEvent(
  id: string,
  beat: number,
  duration: number,
  scaleDegree: NoteEvent['scaleDegree'] = 3,
): NoteEvent {
  return {
    id,
    scaleDegree,
    octave: 0,
    chromatic: 0,
    beat,
    duration,
    isRest: false,
    velocity: 100,
  };
}

/** Same shape as EditorCanvas.entryModes tests — chord + one melody note so digit `3` appends next. */
function makeSongChordAndNote(ch: ChordEvent, note: NoteEvent): SongData {
  const song = buildDefaultSong();
  song.measures[0].chords.push(ch);
  song.measures[0].notes[0].push(note);
  return song;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EditorLayout — UI-W3 — left panel placement duration (RA-5)', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.getState().setSelection({ type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 });
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('applies left-panel duration preset so the next chord placement from the palette uses that tick length', async () => {
    const user = userEvent.setup();
    renderEditorAtLocalEditor();

    const canvas = await screen.findByRole('application', { name: /Song editor/i });
    (canvas as HTMLElement).focus();

    await user.click(screen.getByTestId('left-panel-duration-ticks-96'));
    await user.click(screen.getByTestId('chord-palette-degree-5'));

    await waitFor(() => {
      const ch = useSongStore.getState().song.measures[0]?.chords[0];
      expect(ch?.duration).toBe(96);
      expect(ch?.scaleDegree).toBe(5);
    });
  });

  it('uses a different left-panel duration preset so the next chord placement duration differs (48 vs 96)', async () => {
    const user = userEvent.setup();
    renderEditorAtLocalEditor();

    const canvas = await screen.findByRole('application', { name: /Song editor/i });
    (canvas as HTMLElement).focus();

    await user.click(screen.getByTestId('left-panel-duration-ticks-48'));
    await user.click(screen.getByTestId('chord-palette-degree-1'));

    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0]?.chords[0]?.duration).toBe(48);
    });

    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.getState().setSelection({ type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 });

    await user.click(screen.getByTestId('left-panel-duration-ticks-96'));
    await user.click(screen.getByTestId('chord-palette-degree-1'));

    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0]?.chords[0]?.duration).toBe(96);
    });
  });
});

describe('EditorLayout — UI-W3 — melody entry vs keyboard baseline (RA-6)', () => {
  beforeEach(() => {
    stubCanvas2d();
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('melody pitch E button yields the same new note as keyboard digit 3 with identical duration and measure context', async () => {
    const user = userEvent.setup();
    const chordId = randomUUID();
    const noteId = randomUUID();
    const song = makeSongChordAndNote(chordEvent(chordId, 0, 48), noteEvent(noteId, 48, 24, 3));

    const keyboardSnapshot = noteListAfterKeyboardDigit3(structuredClone(song), noteId);

    useSongStore.getState().loadSong(structuredClone(song));
    useUIStore.getState().setSelection({ type: 'note', measureIndex: 0, eventIds: [noteId] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    await user.click(screen.getByTestId('melody-entry-pitch-E'));

    await waitFor(() => {
      const notes = useSongStore.getState().song.measures[0]!.notes[0];
      expect(notesEqualSansIds(notes, keyboardSnapshot)).toBe(true);
    });
  });

  it('melody rest button adds or updates with isRest true matching keyboard baseline where applicable', async () => {
    const user = userEvent.setup();
    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.getState().setSelection({ type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 });

    renderEditorAtLocalEditor();
    const canvas = await screen.findByRole('application', { name: /Song editor/i });
    (canvas as HTMLElement).focus();

    await user.click(screen.getByTestId('melody-entry-rest'));

    await waitFor(() => {
      const n = useSongStore.getState().song.measures[0]?.notes[0][0];
      expect(n?.isRest).toBe(true);
    });
  });

  it('chromatic toggle exposes aria-pressed and toggles on click', async () => {
    const user = userEvent.setup();
    useSongStore.getState().loadSong(buildDefaultSong());
    renderEditorAtLocalEditor();

    const t = screen.getByTestId('melody-entry-chromatic-toggle');
    expect(t.getAttribute('aria-pressed')).toBe('false');

    await user.click(t);
    expect(t.getAttribute('aria-pressed')).toBe('true');

    await user.click(t);
    expect(t.getAttribute('aria-pressed')).toBe('false');
  });

  it('raise-half and lower-half nudge chromatic offset on the selected note (−1 / +1 vs prior)', async () => {
    const user = userEvent.setup();
    const nid = randomUUID();
    const s = buildDefaultSong();
    s.measures[0].notes[0].push({
      id: nid,
      scaleDegree: 3,
      octave: 0,
      chromatic: 0,
      beat: 0,
      duration: 48,
      isRest: false,
      velocity: 100,
    });
    useSongStore.getState().loadSong(s);
    useUIStore.getState().setSelection({ type: 'note', measureIndex: 0, eventIds: [nid] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    await user.click(screen.getByTestId('melody-entry-raise-half'));
    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0]?.notes[0][0]?.chromatic).toBe(1);
    });

    await user.click(screen.getByTestId('melody-entry-lower-half'));
    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0]?.notes[0][0]?.chromatic).toBe(0);
    });
  });
});

describe('EditorLayout — UI-W3 — chord palette diatonic/borrowed regression smoke', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.getState().setSelection({ type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 });
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('Borrowed tab still shows borrowed scale select and adds a borrowed chord when rows exist', async () => {
    const user = userEvent.setup();
    renderEditorAtLocalEditor();

    await user.click(screen.getByRole('button', { name: /^Borrowed$/ }));

    const sel = screen.queryByTestId('chord-palette-borrowed-scale');
    if (!sel) {
      throw new Error('Expected borrowed scale <select> when QA regression test runs with C major');
    }

    const b4 = screen.queryByTestId('chord-palette-borrowed-degree-4');
    if (!b4) {
      // No differing chords between parallel modes for this key — still assert tab rendered palette root
      expect(screen.getByTestId('chord-palette-root')).toBeInTheDocument();
      return;
    }

    await user.click(b4);

    await waitFor(() => {
      const ch = useSongStore.getState().song.measures[0]?.chords[0];
      expect(ch).toBeDefined();
      expect(ch?.borrowed).not.toBeNull();
    });
  });

  it('Diatonic tab still adds a diatonic chord (borrowed null) from the palette', async () => {
    const user = userEvent.setup();
    renderEditorAtLocalEditor();

    await user.click(screen.getByRole('button', { name: /^Diatonic$/ }));
    await user.click(screen.getByTestId('chord-palette-degree-6'));

    await waitFor(() => {
      const ch = useSongStore.getState().song.measures[0]?.chords[0];
      expect(ch?.scaleDegree).toBe(6);
      expect(ch?.borrowed).toBeNull();
    });
  });
});
