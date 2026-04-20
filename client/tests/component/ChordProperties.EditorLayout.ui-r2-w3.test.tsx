/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — UI-R2-W3
 *
 * Criterion RA-202: Chord properties panel control density and layout
 *   happy: selected-chord Type/Seventh/Inversion appear as compact horizontal button groups,
 *     and options render as a compact checkbox grid
 *   error: dropdowns, single-select lists, or unsupported control patterns remain
 *   edges: multiple option rows toggle independently; inversion buttons expose clear selected state
 *
 * Criterion 3: Chord edit mutation contract remains update-only and patch-safe
 *   happy: UI events call `onUpdate`/`onChordUpdate` with only `Partial<ChordEvent>` fields
 *   error: unsupported contract fields (e.g. `id`, `beat`, `duration`) are introduced
 *   edges: no-op clicks and repeated toggles remain deterministic payloads
 */

import type { ChordEvent } from '@vybpad/shared';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChordProperties } from '@/components/panels/ChordProperties';
import { EditorPropertiesPanel } from '@/components/panels/EditorPropertiesPanel';

const SUPPORTED_PATCH_KEYS = [
  'scaleDegree',
  'quality',
  'seventh',
  'suspension',
  'addition',
  'inversion',
  'borrowed',
  'secondary',
] as const satisfies ReadonlyArray<keyof ChordEvent>;

function sampleChord(overrides: Partial<ChordEvent>): ChordEvent {
  return {
    id: 'chord-ra-202',
    scaleDegree: 5,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat: 0,
    duration: 48,
    ...overrides,
  };
}

function assertPatchIsChordEditSafe(patch: unknown): void {
  const asRecord = typeof patch === 'object' && patch !== null ? (patch as Record<string, unknown>) : null;
  expect(asRecord).not.toBeNull();
  if (!asRecord) return;

  for (const key of Object.keys(asRecord)) {
    expect(SUPPORTED_PATCH_KEYS).toContain(key as keyof ChordEvent);
  }

  expect(asRecord).not.toHaveProperty('id');
  expect(asRecord).not.toHaveProperty('beat');
  expect(asRecord).not.toHaveProperty('duration');
  expect(asRecord).not.toHaveProperty('scale');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ChordProperties — UI-R2-W3 — RA-202 control structure', () => {
  it('renders Type/Seventh/Inversion controls as horizontal button groups and options as a checkbox grid', async () => {
    const user = userEvent.setup();
    const chord = sampleChord({});
    const onUpdate = vi.fn();

    render(
      <ChordProperties
        chord={chord}
        currentKey="C"
        theoryScale="major"
        onUpdate={onUpdate}
        onSecondaryCycle={() => undefined}
        onSecondaryClear={() => undefined}
      />,
    );

    const typeGroup = screen.getByRole('group', { name: /chord type/i });
    const seventhGroup = screen.getByRole('group', { name: /chord seventh/i });
    const inversionGroup = screen.getByRole('group', { name: /inversion/i });
    const optionsGroup = screen.getByRole('group', { name: /options/i });

    expect(typeGroup.className).not.toMatch(/\bflex-col\b/);
    expect(seventhGroup.className).not.toMatch(/\bflex-col\b/);
    expect(typeGroup.className).toMatch(/\bflex-row\b|\bgrid\b/);
    expect(seventhGroup.className).toMatch(/\bflex-row\b|\bgrid\b/);
    expect(inversionGroup.className).toMatch(/\bflex-row\b|\bgrid\b/);

    const typeButtons = within(typeGroup).getAllByRole('button');
    const seventhButtons = within(seventhGroup).getAllByRole('button');
    const inversionButtons = within(inversionGroup).getAllByRole('button');

    expect(typeButtons.length).toBeGreaterThan(1);
    expect(seventhButtons.length).toBeGreaterThan(1);
    expect(inversionButtons.length).toBeGreaterThanOrEqual(2);

    expect(within(optionsGroup).getAllByRole('checkbox').length).toBeGreaterThanOrEqual(3);
    expect(within(optionsGroup).getAllByRole('checkbox').length).toBeLessThanOrEqual(16);
    expect(optionsGroup.className).toMatch(/grid/);
    expect(optionsGroup).toHaveTextContent(/sus2/i);
    expect(optionsGroup).toHaveTextContent(/add9/i);

    const selectableSeventhButton = seventhButtons.find((btn) => btn.getAttribute('aria-pressed') !== 'true') ?? seventhButtons[0];
    await user.click(selectableSeventhButton);

    const option = within(optionsGroup).getByRole('checkbox', { name: /sus2/i });
    if (!option.checked) {
      await user.click(option);
    }

    const optionPatch = onUpdate.mock.calls.at(-1)?.[0];
    expect(optionPatch).toBeDefined();
    assertPatchIsChordEditSafe(optionPatch);
  });

  it('forwards valid `ChordEditAction`-shaped patch payloads from the properties panel selection flow', async () => {
    const user = userEvent.setup();
    const patchTarget = sampleChord({ quality: 'major', seventh: 'dom7', inversion: 1, duration: 96 });
    const onChordUpdate = vi.fn();

    render(
      <EditorPropertiesPanel
        selectionType="chord"
        chordContext={{
          measureIndex: 7,
          chord: patchTarget,
        }}
        chordKey="C"
        chordTheoryScale="major"
        onChordUpdate={onChordUpdate}
      />,
    );

    const typeButtons = screen.getAllByRole('button', { name: /Triad|7|9|11|13/ });
    expect(typeButtons.length).toBeGreaterThan(0);

    const seventhButtons = screen.getAllByRole('button', { name: /None|7|9|11|13/ });
    await user.click(typeButtons[1]);
    await user.click(seventhButtons[0]);

    await waitFor(() => {
      expect(onChordUpdate).toHaveBeenCalled();
    });

    const finalCall = onChordUpdate.mock.calls.at(-1);
    expect(finalCall).not.toBeUndefined();
    expect(finalCall?.[0]).toBe(7);
    expect(finalCall?.[1]).toBe('chord-ra-202');
    const finalPatch = finalCall?.[2] ?? null;
    assertPatchIsChordEditSafe(finalPatch);

    for (const call of onChordUpdate.mock.calls) {
      const [, , patch] = call;
      assertPatchIsChordEditSafe(patch);
    }
  });
});
