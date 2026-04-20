/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — UI-W4 (REF_AUDIT_1 RA-4 — right-hand properties: melody + chord)
 *
 * Criterion 1 — Melody: active voice 0–3, per-voice visibility, inactive display mode, smart octave:
 *   happy: user changes controls → `UIStore` reflects `activeVoice`, `melodyVoiceVisible`,
 *     `inactiveMelodyDisplayMode`, `smartOctaveEnabled`; optional canvas `data-*` mirrors props to EditorCanvas
 *   error: (N/A for melody toggles — blocked chord case is criterion 3)
 *   edges: inactive mode three-way (outline | solid | alpha); visibility bitmask changes one voice
 *
 * Criterion 2 — Chord: selected chord → panel edits quality, seventh, suspension, addition, inversion, secondary, borrow:
 *   happy: each control dispatches `editChord` with `update` + `Partial<ChordEvent>`; store chord matches
 *   error: invalid combination blocked (criterion 3)
 *   edges: clearing secondary/borrow to null where applicable
 *
 * Criterion 3 — No silent failure (PAT-001): invalid operation → disabled control OR `showError` toast
 *   happy: N/A
 *   error: e.g. inversion 3 unavailable for triads → option disabled OR toast on blocked apply
 *
 * Criterion 4 — Accessibility (UX §9): primary controls labeled / aria where testable
 *   happy: properties region + key comboboxes expose names (role/aria-label/label association)
 *
 * Builder contract — stable `data-testid`s (right-hand properties / EditorLayout):
 * - `properties-region` — `role="region"` + accessible name (e.g. aria-label="Editor properties")
 * - Melody: `properties-melody-active-voice-0` … `properties-melody-active-voice-3` (radio or toggle buttons)
 * - `properties-melody-voice-0-visible` … `properties-melody-voice-3-visible` (checkboxes)
 * - `properties-inactive-melody-display-mode` — <select> with values outline | solid | alpha
 * - `properties-smart-octave` — checkbox or switch (aria-checked for switch)
 * - Chord (chord selected): `properties-chord-quality`, `properties-chord-seventh`, `properties-chord-suspension`,
 *   `properties-chord-addition`, `properties-chord-inversion`, `properties-chord-secondary`,
 *   `properties-chord-borrow` — each <select> options must match INTERFACES enums / null sentinels
 * - Optional canvas mirror (EditorCanvas root canvas node): `data-melody-inactive-display-mode`,
 *   `data-melody-voice-visible` (e.g. "1111"), `data-smart-octave` ("true"|"false") for RTL verification of props
 *
 * ⛔ INTERFACES: `ChordEvent`, `ChordEditAction`, `UIStore` (UI-W4 fields), `EditorCanvasProps` melody props.
 */

import { randomUUID } from 'node:crypto';

import type { ChordEvent, SongData } from '@vybpad/shared';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorLayout } from '@/app/EditorLayout';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { useToastStore } from '@/store/toastStore';
import { useUIStore } from '@/store/uiStore';

type UIW4State = {
  melodyVoiceVisible?: readonly [boolean, boolean, boolean, boolean];
  inactiveMelodyDisplayMode?: 'outline' | 'solid' | 'alpha';
  smartOctaveEnabled?: boolean;
  setMelodyVoiceVisible?: (voice: 0 | 1 | 2 | 3, visible: boolean) => void;
  setInactiveMelodyDisplayMode?: (mode: 'outline' | 'solid' | 'alpha') => void;
  setSmartOctaveEnabled?: (enabled: boolean) => void;
};

function uiW4State(): UIW4State {
  return useUIStore.getState() as unknown as UIW4State;
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

function baseChord(id: string, beat: number, duration: number): ChordEvent {
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
    duration,
  };
}

function songWithChord(ch: ChordEvent): SongData {
  const song = buildDefaultSong();
  song.measures[0].chords.push(ch);
  return song;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EditorLayout — UI-W4 — melody properties (active voice, visibility, inactive mode, smart octave)', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.getState().setSelection({ type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 });
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('sets active melody voice to 2 when the user activates properties-melody-active-voice-2', async () => {
    const user = userEvent.setup();
    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    await user.click(screen.getByTestId('properties-melody-active-voice-2'));

    await waitFor(() => {
      expect(useUIStore.getState().activeVoice).toBe(2);
    });
  });

  it('updates melodyVoiceVisible in UIStore when toggling properties-melody-voice-1-visible', async () => {
    const user = userEvent.setup();
    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    const before = uiW4State().melodyVoiceVisible ?? ([true, true, true, true] as const);

    await user.click(screen.getByTestId('properties-melody-voice-1-visible'));

    await waitFor(() => {
      const v = uiW4State().melodyVoiceVisible;
      expect(v).toBeDefined();
      expect(v![1]).toBe(!before[1]);
    });
  });

  it('sets inactiveMelodyDisplayMode to outline via properties-inactive-melody-display-mode', async () => {
    const user = userEvent.setup();
    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    await user.selectOptions(screen.getByTestId('properties-inactive-melody-display-mode'), 'outline');

    await waitFor(() => {
      expect(uiW4State().inactiveMelodyDisplayMode).toBe('outline');
    });
  });

  it('mirrors inactive melody display mode on the editor canvas data attribute when implemented', async () => {
    const user = userEvent.setup();
    renderEditorAtLocalEditor();
    const canvas = await screen.findByRole('application', { name: /Song editor/i });

    await user.selectOptions(screen.getByTestId('properties-inactive-melody-display-mode'), 'solid');

    await waitFor(() => {
      expect(canvas).toHaveAttribute('data-melody-inactive-display-mode', 'solid');
    });
  });

  it('toggles smartOctaveEnabled via properties-smart-octave', async () => {
    const user = userEvent.setup();
    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    const before = uiW4State().smartOctaveEnabled ?? false;
    await user.click(screen.getByTestId('properties-smart-octave'));

    await waitFor(() => {
      expect(uiW4State().smartOctaveEnabled).toBe(!before);
    });
  });
});

describe('EditorLayout — UI-W4 — chord properties (selected chord → ChordEvent updates)', () => {
  beforeEach(() => {
    stubCanvas2d();
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('updates quality to minor when properties-chord-quality selects minor', async () => {
    const user = userEvent.setup();
    const cid = randomUUID();
    useSongStore.getState().loadSong(songWithChord(baseChord(cid, 0, 48)));
    useUIStore.getState().setSelection({ type: 'chord', measureIndex: 0, eventIds: [cid] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    await user.click(within(screen.getByTestId('properties-chord-quality')).getByRole('button', { name: /minor/i }));

    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0].chords.find((c) => c.id === cid)?.quality).toBe('minor');
    });
  });

  it('updates seventh to dom7 when properties-chord-seventh selects dom7', async () => {
    const user = userEvent.setup();
    const cid = randomUUID();
    useSongStore.getState().loadSong(songWithChord(baseChord(cid, 0, 48)));
    useUIStore.getState().setSelection({ type: 'chord', measureIndex: 0, eventIds: [cid] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    await user.click(
      within(screen.getByTestId('properties-chord-seventh')).getByRole('button', { name: 'chord seventh 7' }),
    );

    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0].chords.find((c) => c.id === cid)?.seventh).toBe('dom7');
    });
  });

  it('updates suspension to sus4 when properties-chord-suspension selects sus4', async () => {
    const user = userEvent.setup();
    const cid = randomUUID();
    useSongStore.getState().loadSong(songWithChord(baseChord(cid, 0, 48)));
    useUIStore.getState().setSelection({ type: 'chord', measureIndex: 0, eventIds: [cid] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    await user.click(
      within(screen.getByRole('group', { name: /options/i })).getByRole('checkbox', { name: /sus4/i }),
    );

    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0].chords.find((c) => c.id === cid)?.suspension).toBe('sus4');
    });
  });

  it('updates addition to add9 when properties-chord-addition selects add9', async () => {
    const user = userEvent.setup();
    const cid = randomUUID();
    useSongStore.getState().loadSong(songWithChord(baseChord(cid, 0, 48)));
    useUIStore.getState().setSelection({ type: 'chord', measureIndex: 0, eventIds: [cid] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    await user.click(
      within(screen.getByRole('group', { name: /options/i })).getByRole('checkbox', { name: /add9/i }),
    );

    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0].chords.find((c) => c.id === cid)?.addition).toBe('add9');
    });
  });

  it('updates inversion to 2 when properties-chord-inversion selects 2', async () => {
    const user = userEvent.setup();
    const cid = randomUUID();
    const ch = baseChord(cid, 0, 48);
    ch.seventh = 'dom7';
    useSongStore.getState().loadSong(songWithChord(ch));
    useUIStore.getState().setSelection({ type: 'chord', measureIndex: 0, eventIds: [cid] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    await user.click(within(screen.getByTestId('properties-chord-inversion')).getByRole('button', { name: /inversion 2/i }));

    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0].chords.find((c) => c.id === cid)?.inversion).toBe(2);
    });
  });

  it('updates secondary to V of 5 when properties-chord-secondary selects the V/5 option value', async () => {
    const user = userEvent.setup();
    const cid = randomUUID();
    useSongStore.getState().loadSong(songWithChord(baseChord(cid, 0, 48)));
    useUIStore.getState().setSelection({ type: 'chord', measureIndex: 0, eventIds: [cid] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    const secSel = screen.getByTestId('properties-chord-secondary');
    const opt = [...secSel.querySelectorAll('option')].find(
      (o) => o.value === 'V:5' || o.getAttribute('data-secondary') === 'V|5',
    );
    if (!opt) {
      throw new Error(
        'Expected properties-chord-secondary to include option value V:5 (or data-secondary="V|5") mapping to { function: "V", target: 5 }',
      );
    }
    await user.selectOptions(secSel, opt.value);

    await waitFor(() => {
      const sec = useSongStore.getState().song.measures[0].chords.find((c) => c.id === cid)?.secondary;
      expect(sec).toEqual({ function: 'V', target: 5 });
    });
  });

  it('updates borrowed mode when properties-chord-borrow selects minor parallel', async () => {
    const user = userEvent.setup();
    const cid = randomUUID();
    useSongStore.getState().loadSong(songWithChord(baseChord(cid, 0, 48)));
    useUIStore.getState().setSelection({ type: 'chord', measureIndex: 0, eventIds: [cid] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    await user.selectOptions(screen.getByTestId('properties-chord-borrow'), 'minor');

    await waitFor(() => {
      expect(useSongStore.getState().song.measures[0].chords.find((c) => c.id === cid)?.borrowed).toBe('minor');
    });
  });
});

describe('EditorLayout — UI-W4 — blocked chord edit (no silent failure)', () => {
  beforeEach(() => {
    stubCanvas2d();
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('does not apply illegal inversion 3 for a triad without surfacing success — option disabled or error toast', async () => {
    const user = userEvent.setup();
    const showErrorSpy = vi.spyOn(useToastStore.getState(), 'showError');
    const cid = randomUUID();
    useSongStore.getState().loadSong(songWithChord(baseChord(cid, 0, 48)));
    useUIStore.getState().setSelection({ type: 'chord', measureIndex: 0, eventIds: [cid] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    const inversionGroup = screen.getByTestId('properties-chord-inversion');
    const opt3 = within(inversionGroup).queryByRole('button', { name: /^3$/ });

    if (!opt3) {
      expect(useSongStore.getState().song.measures[0].chords.find((c) => c.id === cid)?.inversion).toBe(0);
      showErrorSpy.mockRestore();
      return;
    }

    if ((opt3 as HTMLButtonElement).disabled) {
      expect(useSongStore.getState().song.measures[0].chords.find((c) => c.id === cid)?.inversion).toBe(0);
      expect(showErrorSpy).not.toHaveBeenCalled();
      showErrorSpy.mockRestore();
      return;
    }

    await user.click(opt3);
    await waitFor(() => {
      const inv = useSongStore.getState().song.measures[0].chords.find((c) => c.id === cid)?.inversion;
      const toasted = showErrorSpy.mock.calls.length > 0;
      expect(inv !== 3 || toasted).toBe(true);
    });

    showErrorSpy.mockRestore();
  });
});

describe('EditorLayout — UI-W4 — accessibility (UX §9)', () => {
  beforeEach(() => {
    stubCanvas2d();
    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.getState().setSelection({ type: 'range', measureIndex: 0, rangeStart: 0, rangeEnd: 0 });
    while (useUIStore.getState().entryMode !== 'table') {
      useUIStore.getState().toggleEntryMode();
    }
  });

  it('exposes properties-region as a named landmark for assistive tech', async () => {
    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    const label = screen.getByTestId('properties-region').getAttribute('aria-label')?.trim();
    expect(label && label.length > 0).toBe(true);
  });

  it('exposes accessible names for primary chord property comboboxes when a chord is selected', async () => {
    const cid = randomUUID();
    useSongStore.getState().loadSong(songWithChord(baseChord(cid, 0, 48)));
    useUIStore.getState().setSelection({ type: 'chord', measureIndex: 0, eventIds: [cid] });

    renderEditorAtLocalEditor();
    await screen.findByRole('application', { name: /Song editor/i });

    for (const tid of [
      'properties-chord-quality',
      'properties-chord-seventh',
      'properties-chord-inversion',
    ] as const) {
      const el = screen.getByTestId(tid);
      const hasAriaLabel = Boolean(el.getAttribute('aria-label')?.trim());
      const labelledBy = el.getAttribute('aria-labelledby');
      const hasLabelledBy =
        Boolean(labelledBy) &&
        labelledBy!
          .split(/\s+/)
          .some((id) => document.getElementById(id)?.textContent?.trim());
      const hasForLabel =
        Boolean(el.id) && Boolean(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim());
      expect(hasAriaLabel || hasLabelledBy || hasForLabel).toBe(true);
    }
  });
});
