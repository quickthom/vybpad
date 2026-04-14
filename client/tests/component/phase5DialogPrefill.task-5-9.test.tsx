/** @vitest-environment jsdom */
/**
 * QA COVERAGE — TASK-5.9 dialog prefill sweep
 *
 * ROADMAP Phase 5 milestone mapping:
 * - Key change at measure 5: key/scale dialog must expose the effective measure-5 context.
 * - Meter + tempo change at measure 9: tempo/meter dialog must expose the overridden measure-9 values.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { KeyScaleChangeDialog } from '../../src/components/common/KeyScaleChangeDialog';
import { TempoMeterAtMeasureDialog } from '../../src/components/controls/TempoMeterAtMeasureDialog';
import { useSongStore } from '../../src/store/songStore';
import { buildPhase5MilestoneSong } from '../fixtures/phase5MilestoneSong';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useSongStore.getState().loadSong(buildPhase5MilestoneSong());
});

describe('TASK-5.9 — dialog prefills reflect Phase 5 measure overrides', () => {
  it('prefills the key/scale dialog with the measure-5 override from SongStore', async () => {
    render(<KeyScaleChangeDialog open measureIndex={4} onClose={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Key and scale' });
    expect(dialog).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Key' })).toHaveValue('D');
    expect(screen.getByRole('combobox', { name: 'Scale / mode' })).toHaveValue('minor');
  });

  it('prefills the tempo/meter dialog with the measure-9 override from SongData', () => {
    const song = buildPhase5MilestoneSong();

    render(
      <TempoMeterAtMeasureDialog
        open
        measureIndex={8}
        song={song}
        onDismiss={() => {}}
        onApply={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: /Tempo & meter/i })).toBeVisible();
    expect(screen.getByLabelText('Tempo (BPM)')).toHaveValue(240);
    expect(screen.getByLabelText('Beats per bar')).toHaveValue(3);
    expect(screen.getByLabelText('Beat unit')).toHaveValue('4');
  });
});
