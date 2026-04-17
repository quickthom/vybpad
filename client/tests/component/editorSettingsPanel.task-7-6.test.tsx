/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — TASK-7.6
 *
 * Criterion — ROADMAP 7.6 + INTERFACES `EditorSettingsPanelProps`: panel exposes entry mode,
 *   label mode, color scheme, chord guide overlay, staff spacing; binds to UIStore-shaped fields.
 *   happy: region + labeled groups; user gestures invoke callbacks with correct literal types;
 *     current props are reflected as selected/checked state in the DOM.
 *   error: n/a (display-only + callbacks)
 *   edges: every enum option is reachable; guides boolean toggles.
 *
 * Selector contract (data-testid): Builder MUST expose these for deterministic RTL tests:
 *   - editor-settings-panel (root, role=region or complementary)
 *   - editor-settings-entry-table | editor-settings-entry-text
 *   - editor-settings-label-degree | editor-settings-label-roman | editor-settings-label-both | editor-settings-label-off
 *   - editor-settings-color-diatonic | editor-settings-color-major
 *   - editor-settings-show-guides (checkbox or switch)
 *   - editor-settings-staff-compact | editor-settings-staff-default | editor-settings-staff-wide
 */

import { EditorSettingsPanel } from '@/components/panels/EditorSettingsPanel';
import type { ComponentProps } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function defaultProps(
  overrides: Partial<ComponentProps<typeof EditorSettingsPanel>> = {},
): ComponentProps<typeof EditorSettingsPanel> {
  return {
    entryMode: 'table',
    labelMode: 'degree',
    colorScheme: 'diatonic',
    showGuides: false,
    staffSpacing: 'default',
    onEntryModeChange: vi.fn(),
    onLabelModeChange: vi.fn(),
    onColorSchemeChange: vi.fn(),
    onShowGuidesChange: vi.fn(),
    onStaffSpacingChange: vi.fn(),
    ...overrides,
  };
}

describe('EditorSettingsPanel — TASK-7.6 — INTERFACES EditorSettingsPanelProps / DOM contract', () => {
  describe('happy path — layout & accessibility', () => {
    it('renders a named settings region (complementary or region) including "Editor" and "settings" in the accessible name', () => {
      render(<EditorSettingsPanel {...defaultProps()} />);

      const panel =
        screen.queryByRole('complementary', { name: /editor.*settings/i }) ??
        screen.getByRole('region', { name: /editor.*settings/i });
      expect(panel).toBeTruthy();
      expect(panel).toHaveAttribute('data-testid', 'editor-settings-panel');
    });
  });

  describe('happy path — props reflected in UI state', () => {
    it('marks entry mode "text" as selected via aria-pressed or aria-checked on the text control', () => {
      render(<EditorSettingsPanel {...defaultProps({ entryMode: 'text' })} />);

      const text = screen.getByTestId('editor-settings-entry-text');
      const pressed = text.getAttribute('aria-pressed');
      const checked = text.getAttribute('aria-checked');
      expect(pressed === 'true' || checked === 'true').toBe(true);
    });

    it('marks show guides as enabled when showGuides is true', () => {
      render(<EditorSettingsPanel {...defaultProps({ showGuides: true })} />);

      const guides = screen.getByTestId('editor-settings-show-guides');
      expect(guides).toBeChecked();
    });

    it('reflects labelMode "degree" as the active label-mode control', () => {
      render(<EditorSettingsPanel {...defaultProps({ labelMode: 'degree' })} />);

      const degree = screen.getByTestId('editor-settings-label-degree');
      expect(degree.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('happy path — callbacks', () => {
    it('calls onEntryModeChange with "text" when the user activates the text entry control', async () => {
      const user = userEvent.setup();
      const onEntryModeChange = vi.fn();
      render(<EditorSettingsPanel {...defaultProps({ onEntryModeChange })} />);

      await user.click(screen.getByTestId('editor-settings-entry-text'));

      expect(onEntryModeChange).toHaveBeenCalledTimes(1);
      expect(onEntryModeChange).toHaveBeenCalledWith('text');
    });

    it('calls onLabelModeChange with "roman" when the user selects the roman label control', async () => {
      const user = userEvent.setup();
      const onLabelModeChange = vi.fn();
      render(<EditorSettingsPanel {...defaultProps({ onLabelModeChange })} />);

      await user.click(screen.getByTestId('editor-settings-label-roman'));

      expect(onLabelModeChange).toHaveBeenCalledWith('roman');
    });

    it('calls onLabelModeChange with "degree" when the user selects the degree label control', async () => {
      const user = userEvent.setup();
      const onLabelModeChange = vi.fn();
      render(<EditorSettingsPanel {...defaultProps({ onLabelModeChange })} />);

      await user.click(screen.getByTestId('editor-settings-label-degree'));

      expect(onLabelModeChange).toHaveBeenCalledWith('degree');
    });

    it('calls onColorSchemeChange with "major" when the user selects the major color scheme control', async () => {
      const user = userEvent.setup();
      const onColorSchemeChange = vi.fn();
      render(<EditorSettingsPanel {...defaultProps({ onColorSchemeChange })} />);

      await user.click(screen.getByTestId('editor-settings-color-major'));

      expect(onColorSchemeChange).toHaveBeenCalledWith('major');
    });

    it('calls onShowGuidesChange with true when the user checks the guides control', async () => {
      const user = userEvent.setup();
      const onShowGuidesChange = vi.fn();
      render(<EditorSettingsPanel {...defaultProps({ onShowGuidesChange })} />);

      await user.click(screen.getByTestId('editor-settings-show-guides'));

      expect(onShowGuidesChange).toHaveBeenCalledWith(true);
    });

    it('calls onStaffSpacingChange with "wide" when the user selects wide staff spacing', async () => {
      const user = userEvent.setup();
      const onStaffSpacingChange = vi.fn();
      render(<EditorSettingsPanel {...defaultProps({ onStaffSpacingChange })} />);

      await user.click(screen.getByTestId('editor-settings-staff-wide'));

      expect(onStaffSpacingChange).toHaveBeenCalledWith('wide');
    });
  });

  describe('edge cases — enum coverage', () => {
    it('invokes onLabelModeChange with "both" and "off" when those label controls are activated', async () => {
      const user = userEvent.setup();
      const onLabelModeChange = vi.fn();
      render(<EditorSettingsPanel {...defaultProps({ onLabelModeChange })} />);

      await user.click(screen.getByTestId('editor-settings-label-both'));
      await user.click(screen.getByTestId('editor-settings-label-off'));

      expect(onLabelModeChange.mock.calls).toEqual([['both'], ['off']]);
    });

    it('invokes onStaffSpacingChange with "compact" when the compact staff control is activated', async () => {
      const user = userEvent.setup();
      const onStaffSpacingChange = vi.fn();
      render(<EditorSettingsPanel {...defaultProps({ onStaffSpacingChange })} />);

      await user.click(screen.getByTestId('editor-settings-staff-compact'));

      expect(onStaffSpacingChange).toHaveBeenCalledWith('compact');
    });
  });
});
