/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — F08.1-QA
 *
 * Criterion 1: Inline error element with role="alert" appears when invalid input is submitted
 *   happy: n/a (validation failure path)
 *   error: invalid tempo (OOR, non-integer) and invalid meter render assertive inline message
 *   edges: OOR BPM, decimal BPM, invalid numerator
 *
 * Criterion 2: Toast store showError is not called for validation errors (UX §9 / PAT-001 — no duplicate toast)
 *   happy: n/a
 *   error: same submissions — showError spy receives no calls
 *   edges: tempo validation path vs meter validation path
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

describe('TempoMeterAtMeasureDialog — F08.1 validation (inline alert, no toast)', () => {
  describe('error handling', () => {
    it('shows role="alert" for out-of-range tempo and does not call toast showError', () => {
      const showErrorSpy = vi.spyOn(useToastStore.getState(), 'showError');
      const onApply = vi.fn();
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

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/20 and 300/i);
      expect(showErrorSpy).not.toHaveBeenCalled();
      expect(onApply).not.toHaveBeenCalled();
      showErrorSpy.mockRestore();
    });

    it('shows role="alert" for non-integer tempo and does not call toast showError', () => {
      const showErrorSpy = vi.spyOn(useToastStore.getState(), 'showError');
      const onApply = vi.fn();
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

    it('shows role="alert" for invalid meter and does not call toast showError', () => {
      const showErrorSpy = vi.spyOn(useToastStore.getState(), 'showError');
      const onApply = vi.fn();
      render(
        <TempoMeterAtMeasureDialog
          open
          measureIndex={0}
          song={minimalSong}
          onDismiss={vi.fn()}
          onApply={onApply}
        />,
      );
      fireEvent.change(screen.getByLabelText(/beats per bar/i), { target: { value: '0' } });
      fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));

      expect(screen.getByRole('alert')).toHaveTextContent(/time signature/i);
      expect(showErrorSpy).not.toHaveBeenCalled();
      expect(onApply).not.toHaveBeenCalled();
      showErrorSpy.mockRestore();
    });
  });
});
