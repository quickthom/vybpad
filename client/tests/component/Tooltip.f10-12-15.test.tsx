/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — F10-12–15 (Tooltip)
 *
 * Criterion 4 — Custom Tooltip (no Radix): open on focus + pointer hover after delay; `aria-describedby`
 *   links tooltip id; Escape dismisses when opened from keyboard focus path.
 *   happy: hover → delay → role=tooltip; describedby; Escape clears (keyboard-open path)
 *   edges: N/A
 */

import { Tooltip } from '@/components/common/Tooltip';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Matches UX §8 / F10 Builder default hover delay. */
const SHOW_DELAY_MS = 120;

describe('F10-12–15 — Tooltip (accessible description + timing)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    cleanup();
  });

  describe('happy path', () => {
    it('opens the tooltip after pointer hover delay and sets aria-describedby to the tooltip id', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <Tooltip label="Supplemental description">
          <button type="button">Action</button>
        </Tooltip>,
      );
      const btn = screen.getByRole('button', { name: 'Action' });
      await user.hover(btn);
      await vi.advanceTimersByTimeAsync(SHOW_DELAY_MS);

      const tip = screen.getByRole('tooltip', { name: 'Supplemental description' });
      expect(tip.id).toBeTruthy();
      const describedBy = btn.getAttribute('aria-describedby') ?? '';
      expect(describedBy.split(/\s+/).some((id) => id === tip.id)).toBe(true);
    });

    it('opens on keyboard focus (focus-visible path) after the same delay', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (this: HTMLElement, sel: string) {
        if (typeof sel === 'string' && sel.includes('focus-visible')) return true;
        return Element.prototype.matches.call(this, sel);
      });

      render(
        <Tooltip label="Focused trigger tip">
          <button type="button">Focus me</button>
        </Tooltip>,
      );
      const btn = screen.getByRole('button', { name: 'Focus me' });
      await user.tab();
      expect(btn).toHaveFocus();
      await vi.advanceTimersByTimeAsync(SHOW_DELAY_MS);

      expect(screen.getByRole('tooltip', { name: 'Focused trigger tip' })).toBeInTheDocument();
    });

    it('dismisses on Escape when the tooltip was opened from the keyboard focus path', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (this: HTMLElement, sel: string) {
        if (typeof sel === 'string' && sel.includes('focus-visible')) return true;
        return Element.prototype.matches.call(this, sel);
      });

      render(
        <Tooltip label="Dismiss with Escape">
          <button type="button">Kb</button>
        </Tooltip>,
      );
      const btn = screen.getByRole('button', { name: 'Kb' });
      await user.tab();
      expect(btn).toHaveFocus();
      await vi.advanceTimersByTimeAsync(SHOW_DELAY_MS);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
