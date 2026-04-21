/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — UI-W8 (Wave 8 — INTERFACES TransportControls + RA-15 gate)
 *
 * RA-16/21: horizontal zoom ± and reset (1:1 = default zoom 1.0 → zoomPercent 100); callbacks fire.
 *   happy: zoom readout + vybpad-zoom-in/out/reset invoke handlers; reset labeled for 1:1 semantics
 *   error: —
 *   edges: —
 *
 * RA-20: tempo/meter edit entry from top transport (onTempoMeterEdit + key/meter labels).
 *   happy: control reachable with stable test id; click invokes callback
 *   edges: optional props omitted → no crash (backward compatible)
 *
 * RA-13/14: record + metronome toggles visible; aria-pressed reflects store-backed props.
 *   happy: vybpad-transport-record + vybpad-transport-metronome; pressed state matches props
 *
 * RA-15 (gate B): Band/Lyrics/Stable disabled stubs; single trio (no duplicate deferred row).
 *   happy: exactly one sr-only MVP hint; three disabled buttons with Not in MVP tooltip
 *
 * Contract: INTERFACES.md — TransportControlsProps (UI-W8 optional props).
 * Props are cast at the call site because the component implementation may lag INTERFACES until Builder lands UI-W8.
 */

import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TransportControls } from '@/components/controls/TransportControls';

/** INTERFACES.md § TransportControls — UI-W8 fields (forward contract). */
type TransportControlsPropsW8 = ComponentProps<typeof TransportControls> & {
  recordArmed?: boolean;
  onRecordToggle?: () => void;
  metronomeEnabled?: boolean;
  onMetronomeToggle?: () => void;
  zoomPercent?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  zoomYPercent?: number;
  onZoomYIn?: () => void;
  onZoomYOut?: () => void;
  onZoomYReset?: () => void;
  keyLabel?: string;
  meterLabel?: string;
  onTempoMeterEdit?: () => void;
};

function baseProps(): TransportControlsPropsW8 {
  return {
    isPlaying: false,
    tempo: 120,
    currentBeat: '1:1',
    initStatus: 'ready',
    initErrorCode: null,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onStop: vi.fn(),
    onRewind: vi.fn(),
    onTempoChange: vi.fn(),
  };
}

function renderW8(overrides: Partial<TransportControlsPropsW8> = {}) {
  const props = { ...baseProps(), ...overrides };
  return render(<TransportControls {...(props as ComponentProps<typeof TransportControls>)} />);
}

describe('TransportControls — UI-W8 — zoom (RA-16/21)', () => {
  describe('happy path', () => {
    it('shows zoomPercent in the zoom readout and wires vybpad-zoom-in, vybpad-zoom-out, vybpad-zoom-reset', async () => {
      const user = userEvent.setup();
      const onZoomIn = vi.fn();
      const onZoomOut = vi.fn();
      const onZoomReset = vi.fn();
      renderW8({
        zoomPercent: 150,
        onZoomIn,
        onZoomOut,
        onZoomReset,
      });

      expect(screen.getByTestId('vybpad-zoom-readout')).toHaveTextContent(/150/);

      await user.click(screen.getByTestId('vybpad-zoom-in'));
      await user.click(screen.getByTestId('vybpad-zoom-out'));
      await user.click(screen.getByTestId('vybpad-zoom-reset'));

      expect(onZoomIn).toHaveBeenCalledTimes(1);
      expect(onZoomOut).toHaveBeenCalledTimes(1);
      expect(onZoomReset).toHaveBeenCalledTimes(1);
    });

    it('labels zoom reset as 1:1 (maps to default zoom factor 1.0 → 100% readout contract)', () => {
      renderW8({
        zoomPercent: 200,
        onZoomReset: vi.fn(),
      });
      const reset = screen.getByTestId('vybpad-zoom-reset');
      expect(reset).toHaveAccessibleName(/1:1/i);
    });
  });
});

describe('TransportControls — UI-R2-W7.2 — vertical zoom (RA-210)', () => {
  it('shows zoomYPercent in its readout and wires vertical zoom callbacks', async () => {
    const user = userEvent.setup();
    const onZoomYIn = vi.fn();
    const onZoomYOut = vi.fn();
    const onZoomYReset = vi.fn();
    renderW8({
      zoomYPercent: 130,
      onZoomYIn,
      onZoomYOut,
      onZoomYReset,
    });

    expect(screen.getByTestId('vybpad-zoom-y-readout')).toHaveTextContent(/130/);

    await user.click(screen.getByTestId('vybpad-zoom-y-in'));
    await user.click(screen.getByTestId('vybpad-zoom-y-out'));
    await user.click(screen.getByTestId('vybpad-zoom-y-reset'));

    expect(onZoomYIn).toHaveBeenCalledTimes(1);
    expect(onZoomYOut).toHaveBeenCalledTimes(1);
    expect(onZoomYReset).toHaveBeenCalledTimes(1);
  });

  it('uses independent aria-labels for vertical zoom controls', async () => {
    const user = userEvent.setup();
    const onZoomYIn = vi.fn();
    const onZoomYOut = vi.fn();
    const onZoomYReset = vi.fn();
    renderW8({
      zoomYPercent: 100,
      onZoomYIn,
      onZoomYOut,
      onZoomYReset,
    });

    const zoomYIn = screen.getByRole('button', { name: /zoom melody rows in/i });
    const zoomYOut = screen.getByRole('button', { name: /zoom melody rows out/i });
    const reset = screen.getByTestId('vybpad-zoom-y-reset');
    await user.click(zoomYIn);
    await user.click(zoomYOut);
    await user.click(reset);

    expect(onZoomYIn).toHaveBeenCalledTimes(1);
    expect(onZoomYOut).toHaveBeenCalledTimes(1);
    expect(onZoomYReset).toHaveBeenCalledTimes(1);
    expect(reset).toHaveAccessibleName(/reset melody row zoom to 1:1/i);
  });
});

describe('TransportControls — UI-R2-W7.5 — independent dual zoom controls', () => {
  it('renders both horizontal and vertical zoom clusters when both readouts are supplied', () => {
    renderW8({
      zoomPercent: 100,
      zoomYPercent: 100,
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onZoomReset: vi.fn(),
      onZoomYIn: vi.fn(),
      onZoomYOut: vi.fn(),
      onZoomYReset: vi.fn(),
    });

    expect(screen.getByRole('group', { name: 'Editor canvas zoom' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Editor melody zoom' })).toBeVisible();
    expect(screen.getByTestId('vybpad-zoom-readout')).toHaveTextContent(/100%/);
    expect(screen.getByTestId('vybpad-zoom-y-readout')).toHaveTextContent(/100%/);
  });

  it('keeps zoom callbacks isolated by axis when one control is clicked', async () => {
    const user = userEvent.setup();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onZoomReset = vi.fn();
    const onZoomYIn = vi.fn();
    const onZoomYOut = vi.fn();
    const onZoomYReset = vi.fn();

    renderW8({
      zoomPercent: 120,
      zoomYPercent: 80,
      onZoomIn,
      onZoomOut,
      onZoomReset,
      onZoomYIn,
      onZoomYOut,
      onZoomYReset,
    });

    await user.click(screen.getByTestId('vybpad-zoom-in'));
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).not.toHaveBeenCalled();
    expect(onZoomReset).not.toHaveBeenCalled();
    expect(onZoomYIn).not.toHaveBeenCalled();
    expect(onZoomYOut).not.toHaveBeenCalled();
    expect(onZoomYReset).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('vybpad-zoom-y-in'));
    expect(onZoomYIn).toHaveBeenCalledTimes(1);
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(0);
    expect(onZoomReset).toHaveBeenCalledTimes(0);
    expect(onZoomYOut).not.toHaveBeenCalled();
    expect(onZoomYReset).not.toHaveBeenCalled();
  });
});

describe('TransportControls — UI-W8 — tempo/meter edit entry (RA-20)', () => {
  describe('happy path', () => {
    it('invokes onTempoMeterEdit when the top-band tempo/meter control is activated', async () => {
      const user = userEvent.setup();
      const onTempoMeterEdit = vi.fn();
      renderW8({
        keyLabel: 'C major',
        meterLabel: '4/4',
        onTempoMeterEdit,
      });

      await user.click(screen.getByTestId('vybpad-tempo-meter-edit'));

      expect(onTempoMeterEdit).toHaveBeenCalledTimes(1);
    });

    it('shows keyLabel and meterLabel in the top transport readout cluster', () => {
      renderW8({
        keyLabel: 'D minor',
        meterLabel: '6/8',
        onTempoMeterEdit: vi.fn(),
      });
      expect(screen.getByTestId('vybpad-transport-key-meter-cluster')).toHaveTextContent('D minor');
      expect(screen.getByTestId('vybpad-transport-key-meter-cluster')).toHaveTextContent('6/8');
    });
  });

  describe('edge cases', () => {
    it('renders without key/meter cluster when UI-W8 readout props are omitted (backward compatible)', () => {
      renderW8({});
      expect(screen.queryByTestId('vybpad-transport-key-meter-cluster')).toBeNull();
    });
  });
});

describe('TransportControls — UI-W8 — record + metronome toggles (RA-13/14)', () => {
  describe('happy path', () => {
    it('exposes record and metronome buttons with aria-pressed matching recordArmed and metronomeEnabled', () => {
      const { rerender } = renderW8({
        recordArmed: false,
        metronomeEnabled: false,
        onRecordToggle: vi.fn(),
        onMetronomeToggle: vi.fn(),
      });

      const record = screen.getByTestId('vybpad-transport-record');
      const click = screen.getByTestId('vybpad-transport-metronome');
      expect(record).toHaveAttribute('aria-pressed', 'false');
      expect(click).toHaveAttribute('aria-pressed', 'false');

      rerender(
        <TransportControls
          {...(baseProps() as ComponentProps<typeof TransportControls>)}
          {...({
            recordArmed: true,
            metronomeEnabled: true,
            onRecordToggle: vi.fn(),
            onMetronomeToggle: vi.fn(),
          } as Partial<TransportControlsPropsW8> as ComponentProps<typeof TransportControls>)}
        />,
      );

      expect(screen.getByTestId('vybpad-transport-record')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('vybpad-transport-metronome')).toHaveAttribute('aria-pressed', 'true');
    });

    it('invokes onRecordToggle and onMetronomeToggle when the toggles are clicked', async () => {
      const user = userEvent.setup();
      const onRecordToggle = vi.fn();
      const onMetronomeToggle = vi.fn();
      renderW8({
        onRecordToggle,
        onMetronomeToggle,
      });

      await user.click(screen.getByTestId('vybpad-transport-record'));
      await user.click(screen.getByTestId('vybpad-transport-metronome'));

      expect(onRecordToggle).toHaveBeenCalledTimes(1);
      expect(onMetronomeToggle).toHaveBeenCalledTimes(1);
    });
  });
});

describe('TransportControls — UI-W8 — RA-15 gate B (stub trio, single row)', () => {
  it('renders exactly one deferred MVP hint and three disabled Band/Lyrics/Stable stubs (no duplicate trio)', () => {
    renderW8({});

    const hints = document.querySelectorAll('#vybpad-mvp-deferred-hint');
    expect(hints).toHaveLength(1);

    const stubGroup = screen.getByRole('group', { name: /deferred shell features/i });
    const stubs = within(stubGroup).getAllByRole('button');
    expect(stubs).toHaveLength(3);
    expect(stubs.map((b) => b.textContent)).toEqual(['Band', 'Lyrics', 'Stable']);
    for (const b of stubs) {
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute('title', 'Not in MVP — deferred per ARCHITECTURE roadmap.');
    }
  });
});
