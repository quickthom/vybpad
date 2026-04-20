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
 * Criterion 3 — RA-203: Melody pitch buttons are degree-coded controls (not neutral/undifferentiated)
 *   happy: each pitch button exposes PAT-010 hue aligned to diatonic degree
 *   error: plain surface/neutral appearance without degree anchor
 *   edges: C-major smoke mapping C D E F G A B
 *
 * Criterion 4 — RA-204: Full raise/lower matrix is available and mutates expected note fields
 *   happy: controls exist for half-step, diatonic, and octave; each class mutates the expected state
 *   error: missing control IDs or no-op state updates
 *   edges: diatonic shift preserves chromatic where not explicitly changed; octave shift preserves duration
 *
 * Criterion 5 — RA-214: Add/Split/Tie controls exist and mutate note data
 *   happy: Add inserts note, Split subdivides selected note, Tie merges compatible adjacent note
 *   error: missing controls or incompatible selection leaves note graph unchanged
 *   edges: split no-op safety for non-splittable notes; tie no-op for non-adjacent notes
 *
 * Criterion 6 — No regression to ChordPalette diatonic/borrowed:
 *   happy: mode tabs + borrowed scale select + degree clicks still add chords with expected borrowed flag
 *   error: borrowed tab shows no rows — skip click (documented in test body)
 *
 * Builder contract — stable `data-testid`s (left panel / melody entry region):
 * - `left-panel-duration-ticks-96` — sets shared placement duration to 96 ticks (half note, PAT-004)
 * - `left-panel-duration-ticks-48` — sets placement duration to 48 ticks (quarter)
 * - `melody-entry-pitch-E` — inserts / arms degree 3 in C major (same as keyboard `3` in note-entry context)
 * - `melody-entry-rest` — rest entry (isRest: true per INTERFACES NoteEvent)
 * - `melody-entry-chromatic-toggle` — chromatic entry default +1 semitone on new notes (PAT-018); must expose `aria-pressed`
 * - `melody-entry-raise-half` / `melody-entry-lower-half` — nudge chromatic offset on selection (−1 / +1 semitone vs diatonic)
 * - `melody-entry-raise` / `melody-entry-lower` — diatonic degree +/-1 without chromatic side effect
 * - `melody-entry-raise-octave` / `melody-entry-lower-octave` — octave +/-1 without duration side effect
 * - `melody-entry-add` / `melody-entry-split` / `melody-entry-tie` — note mutation controls in melody entry area
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
import { pat010DiatonicHex } from '@/engine/renderer/colorMaps';
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

const DIATONIC_PITCHES: readonly { degree: number; pitch: string }[] = [
  { degree: 1, pitch: 'C' },
  { degree: 2, pitch: 'D' },
  { degree: 3, pitch: 'E' },
  { degree: 4, pitch: 'F' },
  { degree: 5, pitch: 'G' },
  { degree: 6, pitch: 'A' },
  { degree: 7, pitch: 'B' },
] as const;

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

  it('with chromatic entry on, a placed melody note has non-zero chromatic (default sharp, PAT-018)', async () => {
    const user = userEvent.setup();
    const chordId = randomUUID();
    const noteId = randomUUID();
    const song = makeSongChordAndNote(chordEvent(chordId, 0, 48), noteEvent(noteId, 48, 24, 3));

    useSongStore.getState().loadSong(structuredClone(song));
    useUIStore.getState().setSelection({ type: 'note', measureIndex: 0, eventIds: [noteId] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    await user.click(screen.getByTestId('melody-entry-chromatic-toggle'));
    expect(screen.getByTestId('melody-entry-chromatic-toggle').getAttribute('aria-pressed')).toBe('true');

    await user.click(screen.getByTestId('melody-entry-pitch-E'));

    await waitFor(() => {
      const lane = useSongStore.getState().song.measures[0]!.notes[0];
      const placed = lane[lane.length - 1];
      expect(placed?.scaleDegree).toBe(3);
      expect(placed?.chromatic).not.toBe(0);
      expect(placed?.chromatic).toBe(1);
    });
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

  it('renders each melody pitch button with degree-coded PAT-010 color (RA-203)', async () => {
    const user = userEvent.setup();
    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.getState().setSelection({ type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });
    await user.click(screen.getByRole('application', { name: /Song editor/i }));

    for (const { degree, pitch } of DIATONIC_PITCHES) {
      const button = screen.getByTestId(`melody-entry-pitch-${pitch}`);
      const expectedColor = pat010DiatonicHex(degree as 1 | 2 | 3 | 4 | 5 | 6 | 7).toLowerCase();
      const styleHints = `${button.getAttribute('style') ?? ''} ${button.className}`.toLowerCase();

      expect(styleHints).toContain(expectedColor);
      expect(styleHints).not.toContain('bg-[var(--color-surface,#ffffff)]');
      expect(styleHints).not.toContain('bg-[var(--color-surface-muted,#f9fafb)]');
    }
  });

  it('renders all RA-204 raise/lower controls including half-step, diatonic, and octave IDs', async () => {
    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    expect(screen.queryByTestId('melody-entry-raise-half')).toBeInTheDocument();
    expect(screen.queryByTestId('melody-entry-lower-half')).toBeInTheDocument();
    expect(screen.queryByTestId('melody-entry-raise')).toBeInTheDocument();
    expect(screen.queryByTestId('melody-entry-lower')).toBeInTheDocument();
    expect(screen.queryByTestId('melody-entry-raise-octave')).toBeInTheDocument();
    expect(screen.queryByTestId('melody-entry-lower-octave')).toBeInTheDocument();
  });

  it('mutates note fields for half-step, diatonic, and octave controls with expected boundaries (RA-204)', async () => {
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
      const note = useSongStore.getState().song.measures[0]?.notes[0]?.find((n) => n.id === nid);
      expect(note?.chromatic).toBe(1);
    });

    await user.click(screen.getByTestId('melody-entry-lower-half'));
    await waitFor(() => {
      const note = useSongStore.getState().song.measures[0]?.notes[0]?.find((n) => n.id === nid);
      expect(note?.chromatic).toBe(0);
    });

    await user.click(screen.getByTestId('melody-entry-raise'));
    await waitFor(() => {
      const note = useSongStore.getState().song.measures[0]?.notes[0]?.find((n) => n.id === nid);
      expect(note?.scaleDegree).toBe(4);
      expect(note?.chromatic).toBe(0);
      expect(note?.duration).toBe(48);
    });

    await user.click(screen.getByTestId('melody-entry-lower'));
    await waitFor(() => {
      const note = useSongStore.getState().song.measures[0]?.notes[0]?.find((n) => n.id === nid);
      expect(note?.scaleDegree).toBe(3);
      expect(note?.duration).toBe(48);
    });

    await user.click(screen.getByTestId('melody-entry-raise-octave'));
    await waitFor(() => {
      const note = useSongStore.getState().song.measures[0]?.notes[0]?.find((n) => n.id === nid);
      expect(note?.octave).toBe(1);
      expect(note?.duration).toBe(48);
    });

    await user.click(screen.getByTestId('melody-entry-lower-octave'));
    await waitFor(() => {
      const note = useSongStore.getState().song.measures[0]?.notes[0]?.find((n) => n.id === nid);
      expect(note?.octave).toBe(0);
      expect(note?.duration).toBe(48);
    });
  });

  it('adds note on selected duration and exposes required RA-214 actions', async () => {
    const user = userEvent.setup();
    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.getState().setSelection({ type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    expect(screen.queryByTestId('melody-entry-add')).toBeInTheDocument();
    expect(screen.queryByTestId('melody-entry-split')).toBeInTheDocument();
    expect(screen.queryByTestId('melody-entry-tie')).toBeInTheDocument();

    await user.click(screen.getByTestId('left-panel-duration-ticks-96'));
    await user.click(screen.getByTestId('melody-entry-add'));

    await waitFor(() => {
      const lane = useSongStore.getState().song.measures[0]?.notes[0];
      expect(lane?.length).toBe(1);
      expect(lane?.[0]?.duration).toBe(96);
    });
  });

  it('RA-214 split action mutates selected note into two contiguous notes', async () => {
    const user = userEvent.setup();
    const splitNoteId = randomUUID();
    const splitSong = buildDefaultSong();
    splitSong.measures[0].notes[0] = [
      {
        id: splitNoteId,
        scaleDegree: 3,
        octave: 0,
        chromatic: 0,
        beat: 0,
        duration: 48,
        isRest: false,
        velocity: 100,
      },
    ];
    useSongStore.getState().loadSong(splitSong);
    useUIStore.getState().setSelection({ type: 'note', measureIndex: 0, eventIds: [splitNoteId] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });
    expect(screen.queryByTestId('melody-entry-split')).toBeInTheDocument();

    await user.click(screen.getByTestId('melody-entry-split'));

    await waitFor(() => {
      const lane = useSongStore.getState().song.measures[0]?.notes[0] ?? [];
      expect(lane).toHaveLength(2);
      expect(lane.reduce((sum, n) => sum + n.duration, 0)).toBe(48);
    });
  });

  it('RA-214 tie action merges adjacent compatible notes on selection', async () => {
    const user = userEvent.setup();
    const tieNoteA = randomUUID();
    const tieNoteB = randomUUID();
    const tieSong = buildDefaultSong();
    tieSong.measures[0].notes[0] = [
      {
        id: tieNoteA,
        scaleDegree: 3,
        octave: 0,
        chromatic: 0,
        beat: 0,
        duration: 24,
        isRest: false,
        velocity: 100,
      },
      {
        id: tieNoteB,
        scaleDegree: 3,
        octave: 0,
        chromatic: 0,
        beat: 24,
        duration: 24,
        isRest: false,
        velocity: 100,
      },
    ];
    useSongStore.getState().loadSong(tieSong);
    useUIStore.getState().setSelection({ type: 'note', measureIndex: 0, eventIds: [tieNoteA] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });
    expect(screen.queryByTestId('melody-entry-tie')).toBeInTheDocument();

    await user.click(screen.getByTestId('melody-entry-tie'));

    await waitFor(() => {
      const lane = useSongStore.getState().song.measures[0]?.notes[0] ?? [];
      expect(lane).toHaveLength(1);
      expect(lane[0]?.duration).toBe(48);
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
