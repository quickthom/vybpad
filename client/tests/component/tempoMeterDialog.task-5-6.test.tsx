/** @vitest-environment jsdom */
/**
 * TASK-5.6 — TempoMeterAtMeasureDialog validation + apply path.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    expect(showErrorSpy).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
    showErrorSpy.mockRestore();
  });
});
