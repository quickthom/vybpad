/** @vitest-environment jsdom */
/*
 * TASK 5.5 — Key/scale change dialog + MeasureChanges.key / MeasureChanges.scale
 */

import { KeyScaleChangeDialog } from '@/components/common/KeyScaleChangeDialog';
import { KeyScaleSelector } from '@/components/common/KeyScaleSelector';
import { getKeyAtMeasure, getScaleAtMeasure } from '@/engine/renderer/tickUtils';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  useSongStore.getState().loadSong(buildDefaultSong());
});

describe('KeyScaleSelector (TASK-5.5)', () => {
  it('calls onKeyChange with parallel transposition by default when key changes', async () => {
    const user = userEvent.setup();
    const onKeyChange = vi.fn();
    const onScaleChange = vi.fn();
    render(
      <KeyScaleSelector currentKey="C" currentScale="major" onKeyChange={onKeyChange} onScaleChange={onScaleChange} />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Key' }), 'G');
    expect(onKeyChange).toHaveBeenCalledWith('G', 'parallel');
    expect(onScaleChange).not.toHaveBeenCalled();
  });

  it('calls onKeyChange with relative when that transposition is selected', async () => {
    const user = userEvent.setup();
    const onKeyChange = vi.fn();
    const { container } = render(
      <KeyScaleSelector currentKey="C" currentScale="major" onKeyChange={onKeyChange} onScaleChange={vi.fn()} />,
    );

    const keyFieldset = container.querySelectorAll('fieldset')[0];
    await user.click(within(keyFieldset as HTMLElement).getByRole('radio', { name: 'Relative' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Key' }), 'A');
    expect(onKeyChange).toHaveBeenCalledWith('A', 'relative');
  });

  it('calls onScaleChange with parallel by default when scale changes', async () => {
    const user = userEvent.setup();
    const onScaleChange = vi.fn();
    render(
      <KeyScaleSelector currentKey="C" currentScale="major" onKeyChange={vi.fn()} onScaleChange={onScaleChange} />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Scale / mode' }), 'dorian');
    expect(onScaleChange).toHaveBeenCalledWith('dorian', 'parallel');
  });

  it('calls onScaleChange with relative when that transposition is selected', async () => {
    const user = userEvent.setup();
    const onScaleChange = vi.fn();
    const { container } = render(
      <KeyScaleSelector currentKey="C" currentScale="major" onKeyChange={vi.fn()} onScaleChange={onScaleChange} />,
    );

    const scaleFieldset = container.querySelectorAll('fieldset')[1];
    expect(scaleFieldset).toBeTruthy();
    await user.click(within(scaleFieldset as HTMLElement).getByRole('radio', { name: 'Relative' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Scale / mode' }), 'minor');
    expect(onScaleChange).toHaveBeenCalledWith('minor', 'relative');
  });
});

describe('KeyScaleChangeDialog (TASK-5.5)', () => {
  it('Apply writes Measure.changes and following measures inherit key/scale', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<KeyScaleChangeDialog open measureIndex={2} onClose={onClose} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Key' }), 'F');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Scale / mode' }), 'minor');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    const song = useSongStore.getState().song;
    expect(song.measures[2].changes?.key).toBe('F');
    expect(song.measures[2].changes?.scale).toBe('minor');
    expect(getKeyAtMeasure(song, 2)).toBe('F');
    expect(getScaleAtMeasure(song, 2)).toBe('minor');
    expect(getKeyAtMeasure(song, 3)).toBe('F');
    expect(getScaleAtMeasure(song, 3)).toBe('minor');
    expect(onClose).toHaveBeenCalled();
  });

  it('Apply at measure 0 also updates SongMetadata key and scale', async () => {
    const user = userEvent.setup();
    render(<KeyScaleChangeDialog open measureIndex={0} onClose={vi.fn()} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Key' }), 'D');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Scale / mode' }), 'dorian');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    const song = useSongStore.getState().song;
    expect(song.metadata.key).toBe('D');
    expect(song.metadata.scale).toBe('dorian');
    expect(song.measures[0].changes?.key).toBe('D');
    expect(song.measures[0].changes?.scale).toBe('dorian');
  });

  it('relative key + tonic A from C major yields A minor before Apply', async () => {
    const user = userEvent.setup();
    render(<KeyScaleChangeDialog open measureIndex={0} onClose={vi.fn()} />);

    const dlg = screen.getByRole('dialog', { name: 'Key and scale' });
    const keyFieldset = dlg.querySelectorAll('fieldset')[0];
    await user.click(within(keyFieldset as HTMLElement).getByRole('radio', { name: 'Relative' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Key' }), 'A');

    expect(screen.getByRole('combobox', { name: 'Key' })).toHaveValue('A');
    expect(screen.getByRole('combobox', { name: 'Scale / mode' })).toHaveValue('minor');
  });

  it('Apply persists relative key change (C major → A relative) as A minor on measure 0 and metadata', async () => {
    const user = userEvent.setup();
    render(<KeyScaleChangeDialog open measureIndex={0} onClose={vi.fn()} />);

    const dlg = screen.getByRole('dialog', { name: 'Key and scale' });
    const keyFieldset = dlg.querySelectorAll('fieldset')[0];
    await user.click(within(keyFieldset as HTMLElement).getByRole('radio', { name: 'Relative' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Key' }), 'A');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    const song = useSongStore.getState().song;
    expect(song.measures[0].changes?.key).toBe('A');
    expect(song.measures[0].changes?.scale).toBe('minor');
    expect(song.metadata.key).toBe('A');
    expect(song.metadata.scale).toBe('minor');
  });

  it('relative scale + minor from C major moves tonic to A (relative minor)', async () => {
    const user = userEvent.setup();
    render(<KeyScaleChangeDialog open measureIndex={1} onClose={vi.fn()} />);

    const dlg = screen.getByRole('dialog', { name: 'Key and scale' });
    const scaleFieldset = dlg.querySelectorAll('fieldset')[1];
    await user.click(within(scaleFieldset as HTMLElement).getByRole('radio', { name: 'Relative' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Scale / mode' }), 'minor');

    expect(screen.getByRole('combobox', { name: 'Key' })).toHaveValue('A');
    expect(screen.getByRole('combobox', { name: 'Scale / mode' })).toHaveValue('minor');
  });

  it('has dialog role and labelled title for WCAG modal pattern', () => {
    render(<KeyScaleChangeDialog open measureIndex={0} onClose={vi.fn()} />);
    const dlg = screen.getByRole('dialog', { name: 'Key and scale' });
    expect(dlg).toHaveAttribute('aria-modal', 'true');
  });
});
