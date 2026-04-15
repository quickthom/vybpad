import type { ReactElement } from 'react';

import type { EditorLabelMode, StaffSpacing } from '../../types/editorChrome';

/** INTERFACES.md `EditorSettingsPanel` — editor chrome bound to `UIStore` (TASK-7.6). */
export interface EditorSettingsPanelProps {
  entryMode: 'table' | 'text';
  labelMode: EditorLabelMode;
  colorScheme: 'diatonic' | 'major';
  showGuides: boolean;
  staffSpacing: StaffSpacing;
  onEntryModeChange: (mode: 'table' | 'text') => void;
  onLabelModeChange: (mode: EditorLabelMode) => void;
  onColorSchemeChange: (scheme: 'diatonic' | 'major') => void;
  onShowGuidesChange: (show: boolean) => void;
  onStaffSpacingChange: (spacing: StaffSpacing) => void;
}

const toggleBase =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2';

const toggleOn =
  'bg-[var(--color-surface,#FFFFFF)] text-[var(--color-text-primary,#111827)] shadow-sm';
const toggleOff =
  'text-[var(--color-text-secondary,#4B5563)] hover:bg-[var(--color-surface,#FFFFFF)]/60';

const labelClass = 'text-[13px] font-medium leading-snug tracking-wide text-[var(--color-text-primary,#111827)]';

export function EditorSettingsPanel(props: EditorSettingsPanelProps): ReactElement {
  const {
    entryMode,
    labelMode,
    colorScheme,
    showGuides,
    staffSpacing,
    onEntryModeChange,
    onLabelModeChange,
    onColorSchemeChange,
    onShowGuidesChange,
    onStaffSpacingChange,
  } = props;

  return (
    <section
      role="region"
      aria-labelledby="vybpad-editor-settings-title"
      data-testid="editor-settings-panel"
      className="flex min-h-0 flex-1 flex-col bg-[var(--color-surface,#FFFFFF)] px-4 pt-3 pb-4"
    >
      <h2
        id="vybpad-editor-settings-title"
        className="text-base font-semibold tracking-tight text-[var(--color-text-primary,#111827)]"
      >
        Editor settings
      </h2>
      <p className="mt-1 text-xs text-[var(--color-text-secondary,#4B5563)]">
        Preferences are saved in this browser only.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2" role="group" aria-label="Entry mode">
          <span className={labelClass}>Entry mode</span>
          <div className="flex gap-1 rounded-lg bg-[var(--color-surface-muted,#F9FAFB)] p-1">
            <button
              type="button"
              data-testid="editor-settings-entry-table"
              aria-pressed={entryMode === 'table'}
              onClick={() => onEntryModeChange('table')}
              className={`${toggleBase} ${entryMode === 'table' ? toggleOn : toggleOff}`}
            >
              Table
            </button>
            <button
              type="button"
              data-testid="editor-settings-entry-text"
              aria-pressed={entryMode === 'text'}
              onClick={() => onEntryModeChange('text')}
              className={`${toggleBase} ${entryMode === 'text' ? toggleOn : toggleOff}`}
            >
              Text
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2" role="group" aria-label="Chord and note labels">
          <span className={labelClass}>Chord and note labels</span>
          <div className="flex flex-wrap gap-1 rounded-lg bg-[var(--color-surface-muted,#F9FAFB)] p-1">
            {(
              [
                ['degree', '1–7'],
                ['roman', 'Roman'],
                ['both', 'Both'],
                ['off', 'Off'],
              ] as const
            ).map(([id, short]) => (
              <button
                key={id}
                type="button"
                data-testid={`editor-settings-label-${id}`}
                aria-pressed={labelMode === id}
                onClick={() => onLabelModeChange(id)}
                className={`${toggleBase} min-w-0 shrink ${labelMode === id ? toggleOn : toggleOff}`}
              >
                {short}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2" role="group" aria-label="Color scheme">
          <span className={labelClass}>Color scheme</span>
          <div className="flex gap-1 rounded-lg bg-[var(--color-surface-muted,#F9FAFB)] p-1">
            <button
              type="button"
              data-testid="editor-settings-color-diatonic"
              aria-pressed={colorScheme === 'diatonic'}
              onClick={() => onColorSchemeChange('diatonic')}
              className={`${toggleBase} ${colorScheme === 'diatonic' ? toggleOn : toggleOff}`}
            >
              Diatonic
            </button>
            <button
              type="button"
              data-testid="editor-settings-color-major"
              aria-pressed={colorScheme === 'major'}
              onClick={() => onColorSchemeChange('major')}
              className={`${toggleBase} ${colorScheme === 'major' ? toggleOn : toggleOff}`}
            >
              Major
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2" role="group" aria-label="Staff spacing">
          <span className={labelClass}>Staff spacing</span>
          <div className="flex gap-1 rounded-lg bg-[var(--color-surface-muted,#F9FAFB)] p-1">
            {(
              [
                ['compact', 'Compact'],
                ['default', 'Default'],
                ['wide', 'Wide'],
              ] as const
            ).map(([id, short]) => (
              <button
                key={id}
                type="button"
                data-testid={`editor-settings-staff-${id}`}
                aria-pressed={staffSpacing === id}
                onClick={() => onStaffSpacingChange(id)}
                className={`${toggleBase} ${staffSpacing === id ? toggleOn : toggleOff}`}
              >
                {short}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 pt-1">
          <input
            id="vybpad-setting-guides"
            data-testid="editor-settings-show-guides"
            type="checkbox"
            checked={showGuides}
            onChange={(e) => onShowGuidesChange(e.target.checked)}
            className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded border border-[var(--color-border-strong,#D1D5DB)] text-[var(--color-primary,#4F46E5)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          />
          <label htmlFor="vybpad-setting-guides" className={`${labelClass} cursor-pointer`}>
            Show guide tones (chord vs scale / chromatic hints)
          </label>
        </div>
      </div>
    </section>
  );
}
