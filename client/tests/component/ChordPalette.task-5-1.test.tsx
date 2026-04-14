/** @vitest-environment jsdom */
/**
 * TASK-5.1 — ChordPalette diatonic tab + INTERFACES ChordPaletteProps contract.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChordPalette } from '../../src/components/panels/ChordPalette';
import { theoryEngine } from '../../src/engine/theory';

describe('ChordPalette — TASK-5.1', () => {
  it('renders seven degree buttons with region/group labels (WCAG chrome)', () => {
    const onChordSelect = vi.fn();
    render(
      <ChordPalette currentKey="C" currentScale="major" mode="diatonic" onChordSelect={onChordSelect} />,
    );
    expect(screen.getByRole('heading', { name: /^Chord palette$/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /diatonic scale degrees/i })).toBeInTheDocument();
    for (let d = 1; d <= 7; d++) {
      expect(screen.getByRole('button', { name: new RegExp(`degree ${d}`, 'i') })).toBeInTheDocument();
    }
  });

  it('emits Omit<ChordEvent,"id"|"beat"|"duration"> with diatonic theory defaults', () => {
    const onChordSelect = vi.fn();
    render(
      <ChordPalette currentKey="C" currentScale="major" mode="diatonic" onChordSelect={onChordSelect} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /degree 5/i }));
    expect(onChordSelect).toHaveBeenCalledTimes(1);
    const payload = onChordSelect.mock.calls[0]![0];
    expect(payload.scaleDegree).toBe(5);
    expect(payload.borrowed).toBeNull();
    expect(payload.secondary).toBeNull();
    expect(payload.inversion).toBe(0);
    expect(payload.suspension).toBe('none');
    expect(payload.addition).toBe('none');
    expect(payload.quality).toBe(theoryEngine.getDiatonicQuality(5, 'major'));
    expect(payload.seventh).toBe(theoryEngine.getDiatonicSeventh(5, 'major'));
  });

  it('renders borrowed palette with scale selector and borrowable degree slots (TASK-5.2)', () => {
    render(
      <ChordPalette currentKey="C" currentScale="major" mode="borrowed" onChordSelect={vi.fn()} />,
    );
    expect(screen.getByRole('region', { name: /chord palette/i })).toBeInTheDocument();
    expect(screen.getByTestId('chord-palette-borrowed-scale')).toBeInTheDocument();
    expect(screen.getByTestId('chord-palette-borrowed-degree-4')).toBeInTheDocument();
  });
});
