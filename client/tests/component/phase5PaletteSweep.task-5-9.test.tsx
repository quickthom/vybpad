/** @vitest-environment jsdom */
/**
 * QA COVERAGE — TASK-5.9 palette/inspector sweep
 *
 * ROADMAP Phase 5 milestone mapping:
 * - Borrowed chord: borrowed palette emits a non-diatonic `ChordEvent` omit payload.
 * - Secondary chord: inspector exposes the cycle/clear controls users operate from the shell.
 * - Inversion + embellishment defaults: borrowed selection keeps public `ChordPaletteProps`
 *   defaults (`inversion`, `addition`, `suspension`) stable.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChordPalette, SecondaryChordInspector } from '../../src/components/panels/ChordPalette';

import type { ChordEvent } from '@vybpad/shared';

describe('TASK-5.9 — palette and secondary inspector sweep', () => {
  it('emits a borrowed chord payload with borrowed mode set and public defaults intact', async () => {
    const user = userEvent.setup();
    const onChordSelect = vi.fn();

    render(
      <ChordPalette currentKey="C" currentScale="major" mode="borrowed" onChordSelect={onChordSelect} />,
    );

    await user.selectOptions(screen.getByLabelText('Borrowed scale'), 'minor');
    await user.click(screen.getByTestId('chord-palette-borrowed-degree-4'));

    expect(onChordSelect).toHaveBeenCalledTimes(1);
    expect(onChordSelect.mock.calls[0]?.[0]).toEqual({
      scaleDegree: 4,
      quality: 'minor',
      seventh: 'min7',
      suspension: 'none',
      addition: 'none',
      inversion: 0,
      borrowed: 'minor',
      secondary: null,
    });
  });

  it('shows enabled secondary inspector controls for a selected applied chord and calls the public callbacks', async () => {
    const user = userEvent.setup();
    const onCycle = vi.fn();
    const onClear = vi.fn();
    const secondaryChord: ChordEvent = {
      id: 'selected-applied',
      scaleDegree: 5,
      quality: 'major',
      seventh: 'dom7',
      suspension: 'none',
      addition: 'none',
      inversion: 1,
      borrowed: null,
      secondary: { function: 'V', target: 2 },
      beat: 0,
      duration: 96,
    };

    render(
      <SecondaryChordInspector chord={secondaryChord} romanLabel="V/ii" onCycle={onCycle} onClear={onClear} />,
    );

    expect(screen.getByText('V/ii')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cycle secondary (d)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Clear to diatonic' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Cycle secondary (d)' }));
    await user.click(screen.getByRole('button', { name: 'Clear to diatonic' }));

    expect(onCycle).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
