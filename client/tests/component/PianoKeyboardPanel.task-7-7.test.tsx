/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-7.7 (INTERFACES.md `PianoKeyboardPanelProps`)
 *
 * Criterion: Read-only piano keyboard strip; parent supplies theory context + MIDI highlights; Web MIDI input out of scope.
 *
 * Observable DOM contract (QA ↔ Builder):
 * - Root is a `section` (or element with `role="region"`) whose accessible name matches /piano keyboard/i.
 * - Each rendered key in range exposes `data-midi="<0–127>"` (query e.g. `[data-midi="60"]`).
 * - Highlighted keys (from `highlightedMidi` that fall in the visible range) set `data-highlighted="true"`.
 * - Non-highlighted keys omit `data-highlighted` or set `data-highlighted="false"`.
 * - Read-only strip: root sets `data-readonly="true"` (visualization only; no performance input).
 *
 * Criterion: `highlightedMidi` drives key emphasis
 *   happy: MIDI numbers in range appear highlighted
 *   error: invalid / out-of-view MIDI values do not break rendering
 *   edges: empty list; duplicates; explicit `lowMidi` / `highMidi` clipping
 *
 * Criterion: `homeKey` + `scale` are accepted for theory context
 *   happy: renders without throw for distinct key/scale pairs
 *   edges: —
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PianoKeyboardPanel } from '@/components/panels/PianoKeyboardPanel';

function getPanelSection(container: HTMLElement): HTMLElement {
  const byRole = container.querySelector('[role="region"][aria-label*="Piano keyboard" i]');
  if (byRole instanceof HTMLElement) return byRole;
  const section = container.querySelector('section[aria-label*="Piano keyboard" i]');
  if (section instanceof HTMLElement) return section;
  throw new Error(
    'Expected a region or section with accessible name containing "Piano keyboard" (case-insensitive).',
  );
}

describe('PianoKeyboardPanel — TASK-7.7 — INTERFACES contract (highlights + read-only)', () => {
  describe('happy path', () => {
    it('renders a labeled piano keyboard region and marks highlightedMidi keys inside the visible range with data-highlighted', () => {
      const { container } = render(
        <PianoKeyboardPanel homeKey="C" scale="major" highlightedMidi={[60, 64, 67]} lowMidi={60} highMidi={71} />,
      );

      const region = getPanelSection(container);
      expect(region).toBeVisible();
      expect(region).toHaveAttribute('data-readonly', 'true');

      const key60 = region.querySelector('[data-midi="60"]');
      const key64 = region.querySelector('[data-midi="64"]');
      const key67 = region.querySelector('[data-midi="67"]');
      expect(key60).not.toBeNull();
      expect(key64).not.toBeNull();
      expect(key67).not.toBeNull();
      expect(key60).toHaveAttribute('data-highlighted', 'true');
      expect(key64).toHaveAttribute('data-highlighted', 'true');
      expect(key67).toHaveAttribute('data-highlighted', 'true');
    });

    it('applies homeKey and scale without throwing (theory context props)', () => {
      const { container: a } = render(
        <PianoKeyboardPanel homeKey="C" scale="major" highlightedMidi={[]} lowMidi={60} highMidi={71} />,
      );
      const { container: b } = render(
        <PianoKeyboardPanel homeKey="G" scale="minor" highlightedMidi={[]} lowMidi={60} highMidi={71} />,
      );

      expect(getPanelSection(a)).toBeVisible();
      expect(getPanelSection(b)).toBeVisible();
    });
  });

  describe('edge cases', () => {
    it('treats empty highlightedMidi as no highlighted keys in range', () => {
      const { container } = render(
        <PianoKeyboardPanel homeKey="C" scale="major" highlightedMidi={[]} lowMidi={60} highMidi={71} />,
      );

      const region = getPanelSection(container);
      const keys = region.querySelectorAll('[data-midi]');
      expect(keys.length).toBeGreaterThan(0);
      for (const el of keys) {
        expect(el).not.toHaveAttribute('data-highlighted', 'true');
      }
    });

    it('deduplicates duplicate MIDI values in highlightedMidi for a single highlighted key', () => {
      const { container } = render(
        <PianoKeyboardPanel homeKey="C" scale="major" highlightedMidi={[60, 60]} lowMidi={60} highMidi={71} />,
      );

      const region = getPanelSection(container);
      const highlighted = region.querySelectorAll('[data-highlighted="true"]');
      const for60 = region.querySelectorAll('[data-midi="60"][data-highlighted="true"]');
      expect(for60.length).toBe(1);
      expect(highlighted.length).toBeGreaterThanOrEqual(1);
    });

    it('does not mark highlights for MIDI outside lowMidi..highMidi even when listed in highlightedMidi', () => {
      const { container } = render(
        <PianoKeyboardPanel homeKey="C" scale="major" highlightedMidi={[72]} lowMidi={60} highMidi={71} />,
      );

      const region = getPanelSection(container);
      expect(region.querySelector('[data-midi="72"]')).toBeNull();
      expect(region.querySelector('[data-highlighted="true"]')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('does not throw when highlightedMidi contains out-of-range MIDI; invalid entries are ignored', () => {
      const { container } = render(
        <PianoKeyboardPanel homeKey="C" scale="major" highlightedMidi={[-1, 200, 60]} lowMidi={60} highMidi={71} />,
      );

      const region = getPanelSection(container);
      expect(region.querySelector('[data-midi="-1"]')).toBeNull();
      expect(region.querySelector('[data-midi="200"]')).toBeNull();
      const k60 = region.querySelector('[data-midi="60"]');
      expect(k60).not.toBeNull();
      expect(k60).toHaveAttribute('data-highlighted', 'true');
    });
  });

  describe('read-only visualization', () => {
    it('exposes the strip as read-only (data-readonly on the keyboard region)', () => {
      const { container } = render(
        <PianoKeyboardPanel homeKey="C" scale="major" highlightedMidi={[]} lowMidi={48} highMidi={72} />,
      );

      const region = getPanelSection(container);
      expect(region).toHaveAttribute('data-readonly', 'true');
    });

    it('does not expose piano keys as tab-focusable interactive buttons (tabIndex >= 0)', () => {
      const { container } = render(
        <PianoKeyboardPanel homeKey="C" scale="major" highlightedMidi={[]} lowMidi={60} highMidi={71} />,
      );

      const region = getPanelSection(container);
      const keys = region.querySelectorAll('[data-midi]');
      expect(keys.length).toBeGreaterThan(0);
      for (const el of keys) {
        const te = el.getAttribute('tabindex');
        if (te === null) continue;
        expect(Number.parseInt(te, 10)).toBeLessThan(0);
      }
    });
  });
});
