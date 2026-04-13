/** @vitest-environment jsdom */

/*
 * TASK-4.2 — Transport loading UX + ARIA (UX §8 / §9).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TransportControls } from '@/components/controls/TransportControls';

describe('TransportControls — TASK-4.2 — sample loading', () => {
  it('shows inline piano sample loading indicator and marks the toolbar busy while initializing', () => {
    render(
      <TransportControls
        isPlaying={false}
        tempo={120}
        currentBeat="1:1"
        initStatus="initializing"
        initErrorCode={null}
        onPlay={() => {}}
        onPause={() => {}}
        onStop={() => {}}
        onRewind={() => {}}
        onTempoChange={() => {}}
      />,
    );

    const toolbar = screen.getByRole('toolbar', { name: 'Transport' });
    expect(toolbar).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(/Loading piano samples/i)).toBeVisible();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('announces readiness with a polite live region when ready', () => {
    render(
      <TransportControls
        isPlaying={false}
        tempo={120}
        currentBeat="1:1"
        initStatus="ready"
        initErrorCode={null}
        onPlay={() => {}}
        onPause={() => {}}
        onStop={() => {}}
        onRewind={() => {}}
        onTempoChange={() => {}}
      />,
    );

    const live = screen.getByText(/Piano samples loaded/i);
    expect(live).toHaveClass('sr-only');
    expect(live).toHaveAttribute('aria-live', 'polite');
  });
});
