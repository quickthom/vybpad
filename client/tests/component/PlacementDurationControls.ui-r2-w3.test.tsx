/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlacementDurationControls } from '@/components/panels/PlacementDurationControls';

const PRESETS = {
  192: '4',
  96: '2',
  48: '1',
  24: '1/2',
  12: '1/4',
} as const;

const PRESET_TICK_ORDER = [192, 96, 48, 24, 12] as const;
const MAX_PRESET_TICKS = 192;

const EXPECTED_PERCENT_BY_TICKS: Record<number, number> = {
  192: 100,
  96: 50,
  48: 25,
  24: 12.5,
  12: 6.25,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function parseWidth(el: Element): { value: number; unit: '%' | 'px' } {
  const style = el.getAttribute('style');
  const match = /width:\s*([0-9]+(?:\.[0-9]+)?)(px|%)?/.exec(style ?? '');
  if (!match || !match[1]) {
    throw new Error(`Missing width style on bar: ${style ?? '<empty>'}`);
  }

  return {
    value: Number(match[1]),
    unit: (match[2] as '%' | 'px') ?? '%',
  };
}

describe('PlacementDurationControls — UI-R2-W3 — RA-205', () => {
  it('renders beats-first active readout', () => {
    render(<PlacementDurationControls currentDurationTicks={48} onDurationTicks={vi.fn()} />);

    const liveText = screen.getByText((_, node) => node instanceof HTMLElement && node.getAttribute('aria-live') === 'polite');
    expect(liveText).toBeTruthy();
    expect(liveText.textContent).toContain('Next note or chord: 1');
    expect(liveText.textContent).not.toMatch(/\bticks\b/i);
  });

  it('couples each preset label with its proportional bar and keeps deterministic widths', () => {
    render(<PlacementDurationControls currentDurationTicks={96} onDurationTicks={vi.fn()} />);

    const widths = PRESET_TICK_ORDER.map((ticks) => {
      const button = screen.getByTestId(`left-panel-duration-ticks-${ticks}`);
      const expectedLabel = PRESETS[ticks as keyof typeof PRESETS];

      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-pressed', String(ticks === 96));
      expect(button).toHaveAttribute('aria-label', `${expectedLabel} beats (${ticks} ticks)`);
      expect(button).toHaveTextContent(expectedLabel);

      const parsed = parseWidth(screen.getByTestId(`left-panel-duration-bar-${ticks}`));

      return { ticks, parsed };
    });

    const units = new Set(widths.map((entry) => entry.parsed.unit));
    expect(units.size).toBe(1);
    const [unit] = units;

    if (unit === '%') {
      for (const { ticks, parsed } of widths) {
        expect(parsed.value).toBeGreaterThan(0);
        expect(parsed.value).toBeLessThanOrEqual(100);
        expect(parsed.value).toBeCloseTo(EXPECTED_PERCENT_BY_TICKS[ticks], 2);
      }
      return;
    }

    const fullWidth = widths.find((entry) => entry.ticks === MAX_PRESET_TICKS)?.parsed.value;
    if (!fullWidth) throw new Error('Expected to compute base width from 192-tick preset');

    for (const { ticks, parsed } of widths) {
      const expected = (ticks / MAX_PRESET_TICKS) * fullWidth;
      expect(parsed.value).toBeGreaterThan(0);
      expect(parsed.value).toBeCloseTo(expected, 2);
    }
  });

  it('flags the active preset in both state and bar affordance', () => {
    render(<PlacementDurationControls currentDurationTicks={24} onDurationTicks={vi.fn()} />);

    const activeButton = screen.getByTestId('left-panel-duration-ticks-24');
    const inactiveButton = screen.getByTestId('left-panel-duration-ticks-48');

    const activeBar = screen.getByTestId('left-panel-duration-bar-24');
    const inactiveBar = screen.getByTestId('left-panel-duration-bar-48');

    expect(activeButton).toHaveAttribute('aria-pressed', 'true');
    expect(activeBar.className).toContain('bg-[var(--color-primary,#4F46E5)]');
    expect(inactiveBar.className).not.toContain('bg-[var(--color-primary,#4F46E5)]');
    expect(activeButton).not.toBe(inactiveButton);
  });

  it('calls onDurationTicks with canonical tick values when a preset action is clicked', async () => {
    const user = userEvent.setup();
    const onDurationTicks = vi.fn();

    render(<PlacementDurationControls currentDurationTicks={48} onDurationTicks={onDurationTicks} />);

    await user.click(screen.getByTestId('left-panel-duration-ticks-96'));

    expect(onDurationTicks).toHaveBeenCalledTimes(1);
    expect(onDurationTicks).toHaveBeenCalledWith(96);
  });
});
