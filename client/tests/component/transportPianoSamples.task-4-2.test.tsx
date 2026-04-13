/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — 4.2 (Transport UX + a11y)
 *
 * Criterion 4: Transport loading UX and aria-live semantics are present
 *   happy: While samples load, toolbar shows piano-oriented loading copy + polite live region;
 *           when ready, a polite live region announces readiness (UX_GUIDELINES § toolbar / piano samples).
 *   error: SAMPLE_LOAD_FAILED shows mapped copy in transport (no raw stack strings); assertive
 *           announcement is ToastHost in full app (single role=alert — UX §9 / §5.7)
 *   edges: —
 *
 * Tests DOM behavior of TransportControls — public props match INTERFACES transport + init fields.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TransportControls } from '@/components/controls/TransportControls';

const noop = (): void => {};

function renderTransport(
  initStatus: 'locked' | 'initializing' | 'ready' | 'error',
  initErrorCode: 'AUDIO_CONTEXT_BLOCKED' | 'SAMPLE_LOAD_FAILED' | 'ENGINE_INIT_FAILED' | null,
): ReturnType<typeof render> {
  return render(
    <TransportControls
      isPlaying={false}
      tempo={120}
      currentBeat="1.1"
      initStatus={initStatus}
      initErrorCode={initErrorCode}
      onPlay={noop}
      onPause={noop}
      onStop={noop}
      onRewind={noop}
      onTempoChange={noop}
    />,
  );
}

describe('Transport — TASK 4.2 — piano sample loading UX + aria-live', () => {
  describe('happy path', () => {
    it('shows piano-oriented loading copy in a polite live region while samples are loading (initializing)', () => {
      renderTransport('initializing', null);

      const toolbar = screen.getByRole('toolbar', { name: 'Transport' });
      expect(toolbar).toBeVisible();

      const loadingText = screen.getByText(/piano|instrument samples|loading samples/i);
      expect(loadingText).toBeVisible();

      const liveContainer = loadingText.closest('[aria-live="polite"]');
      expect(liveContainer).not.toBeNull();
    });

    it('announces readiness with a polite live region that references piano or instrument samples', () => {
      renderTransport('ready', null);

      const toolbar = screen.getByRole('toolbar', { name: 'Transport' });
      const politeLive = toolbar.querySelectorAll('[aria-live="polite"]');
      const readyAnnouncement = [...politeLive].some((el) =>
        /piano|samples|instrument/i.test(el.textContent ?? ''),
      );
      expect(readyAnnouncement).toBe(true);
    });
  });

  describe('error handling', () => {
    it('exposes SAMPLE_LOAD_FAILED with user-safe copy in transport (no raw engine strings)', () => {
      renderTransport('error', 'SAMPLE_LOAD_FAILED');

      const toolbar = screen.getByRole('toolbar', { name: 'Transport' });
      expect(toolbar).toHaveTextContent(/sample|connection|try again/i);
      expect(toolbar.textContent).not.toMatch(/undefined|TypeError|at\s+\w+\s+\(/i);
    });
  });
});
