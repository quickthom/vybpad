/** @vitest-environment jsdom */
/**
 * TASK-5.6 — TempoMeterAtMeasureDialog validation + apply path.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TempoMeterAtMeasureDialog } from '../../src/components/controls/TempoMeterAtMeasureDialog';
import { useToastStore } from '../../src/store/toastStore';

import type { SongData } from '@vybpad/shared';

const minimalSong: SongData = {
  version: '1.0',
  metadata: {
    title: 'T',
    key: 'C',
    scale: 'major',
    tempo: 120,
    meter: { numerator: 4, denominator: 4 },
  },
  measures: [
    { id: 'a', chords: [], notes: [[], [], [], []], changes: undefined },
    { id: 'b', chords: [], notes: [[], [], [], []], changes: undefined },
  ],
  bandConfig: {
    tracks: [
      { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
      { role: 'melody2', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
      { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
      { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
      { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
      { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
      { role: 'drums', instrument: 'piano', volume: 0, mute: true, octave: 0 },
    ],
  },
};

afterEach(() => {
  cleanup();
  useToastStore.setState({ message: null, variant: 'error' });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="vybpad-tempo-open-trigger" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <TempoMeterAtMeasureDialog
        open={open}
        measureIndex={0}
        song={minimalSong}
        onDismiss={() => setOpen(false)}
        onApply={vi.fn()}
      />
    </>
  );
}

describe('TempoMeterAtMeasureDialog — TASK-5.6', () => {
  it('calls onApply with tempo and meter when values are valid', () => {
    const onApply = vi.fn();
    const onDismiss = vi.fn();
    render(
      <TempoMeterAtMeasureDialog
        open
        measureIndex={0}
        song={minimalSong}
        onDismiss={onDismiss}
        onApply={onApply}
      />,
    );
    fireEvent.change(screen.getByLabelText(/tempo \(bpm\)/i), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText(/beats per bar/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/beat unit/i), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(onApply).toHaveBeenCalledWith({ tempo: 90, meter: { numerator: 3, denominator: 4 } });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('shows error and does not apply when tempo is out of range', () => {
    const onApply = vi.fn();
    const showErrorSpy = vi.spyOn(useToastStore.getState(), 'showError');
    render(
      <TempoMeterAtMeasureDialog
        open
        measureIndex={0}
        song={minimalSong}
        onDismiss={vi.fn()}
        onApply={onApply}
      />,
    );
    fireEvent.change(screen.getByLabelText(/tempo \(bpm\)/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(showErrorSpy).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
    showErrorSpy.mockRestore();
  });

  it('rejects decimal tempo (does not round)', () => {
    const onApply = vi.fn();
    const showErrorSpy = vi.spyOn(useToastStore.getState(), 'showError');
    render(
      <TempoMeterAtMeasureDialog
        open
        measureIndex={0}
        song={minimalSong}
        onDismiss={vi.fn()}
        onApply={onApply}
      />,
    );
    fireEvent.change(screen.getByLabelText(/tempo \(bpm\)/i), { target: { value: '90.5' } });
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/whole number/i);
    expect(showErrorSpy).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
    showErrorSpy.mockRestore();
  });

  it('closes on Escape and restores focus to the opening control', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByTestId('vybpad-tempo-open-trigger');
    await user.click(trigger);
    expect(screen.getByTestId('vybpad-tempo-meter-dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('vybpad-tempo-meter-dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes when the header close control is activated', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByTestId('vybpad-tempo-open-trigger'));
    await user.click(screen.getByRole('button', { name: /^close$/i }));
    expect(screen.queryByTestId('vybpad-tempo-meter-dialog')).toBeNull();
  });

  it('wraps Tab from last control to the first tab stop (focus trap)', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByTestId('vybpad-tempo-open-trigger'));
    const applyBtn = screen.getByRole('button', { name: /^apply$/i });
    const closeBtn = screen.getByRole('button', { name: /^close$/i });
    applyBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: false, cancelable: true, bubbles: true });
    expect(closeBtn).toHaveFocus();
  });

  it('wraps Shift+Tab from the first tab stop to the last', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByTestId('vybpad-tempo-open-trigger'));
    const applyBtn = screen.getByRole('button', { name: /^apply$/i });
    const closeBtn = screen.getByRole('button', { name: /^close$/i });
    closeBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: true, cancelable: true, bubbles: true });
    expect(applyBtn).toHaveFocus();
  });
});
