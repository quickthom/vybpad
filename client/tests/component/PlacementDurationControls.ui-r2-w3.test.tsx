/** @vitest-environment jsdom */
import type { MouseEvent } from 'react';

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlacementDurationControls } from '@/components/panels/PlacementDurationControls';

const TICKS_TO_BEATS = {
  192: '4',
  96: '2',
  48: '1',
  24: '1/2',
  12: '1/4',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function pickDurationAccessorByTicks(ticks: number): string {
  return TICKS_TO_BEATS[ticks as keyof typeof TICKS_TO_BEATS] ?? `${ticks / 48}`;
}

describe('PlacementDurationControls — UI-R2-W3 — RA-205', () => {
  it('shows the active duration primarily as beat count, not raw tick text', async () => {
    const onDurationTicks = vi.fn();
    const currentDurationTicks = 48;

    render(<PlacementDurationControls currentDurationTicks={currentDurationTicks} onDurationTicks={onDurationTicks} />);

    const liveText = screen.getByText((_, node) => node instanceof HTMLElement && node.getAttribute('aria-live') === 'polite');
    const visibleLabel = pickDurationAccessorByTicks(currentDurationTicks);
    expect(liveText.textContent).toContain(visibleLabel);
    expect(liveText.textContent).not.toMatch(/\bticks?\b/i);
  });

  it('renders duration presets as beat-oriented labels with bar-action semantics (tick values treated as metadata)', async () => {
    const onDurationTicks = vi.fn();
    render(<PlacementDurationControls currentDurationTicks={48} onDurationTicks={onDurationTicks} />);

    const presetGroup = screen.getByRole('group', { name: /Duration presets/i });
    const buttons = within(presetGroup).getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(5);
    let previousWidth = Number.POSITIVE_INFINITY;

    for (const button of buttons) {
      const compactLabel = button.textContent?.replace(/\([^)]*\)/g, '').trim();
      expect(compactLabel).toBeTruthy();
      expect(compactLabel).toMatch(/^\d+(?:\/\d+)?(?:\.\d+)?$/);

      const barContainer = button.querySelector('span[aria-hidden="true"]');
      const bar = barContainer?.querySelector('span');
      expect(bar).toBeTruthy();
      const width = Number(bar?.getAttribute('style')?.match(/width:\s*([0-9.]+)%/)?.[1]);
      expect(width).toBeGreaterThan(0);
      expect(width).toBeLessThanOrEqual(100);
      expect(width).toBeLessThanOrEqual(previousWidth);
      previousWidth = width;
    }
  });

  it('calls onDurationTicks with canonical tick values when a preset action is clicked', async () => {
    const user = userEvent.setup();
    const onDurationTicks = vi.fn();

    render(<PlacementDurationControls currentDurationTicks={48} onDurationTicks={onDurationTicks} />);

    const button = screen.getByTestId('left-panel-duration-ticks-96');
    await user.click(button);

    expect(onDurationTicks).toHaveBeenCalledTimes(1);
    const arg = onDurationTicks.mock.calls[0]?.[0] as number;
    expect(arg).toBe(96);
    expect(TICKS_TO_BEATS[arg as keyof typeof TICKS_TO_BEATS]).toBeDefined();
  });
});
