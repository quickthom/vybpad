import type { ReactElement } from 'react';

import { useUIStore } from '../../store/uiStore';

const INACTIVE_MODES = ['outline', 'solid', 'alpha'] as const;

/**
 * UI-W4 — melody lane visibility, inactive display mode, smart octave (INTERFACES `UIStore`).
 */
export function MelodyProperties(): ReactElement {
  const activeVoice = useUIStore((s) => s.activeVoice);
  const setActiveVoice = useUIStore((s) => s.setActiveVoice);
  const melodyVoiceVisible = useUIStore((s) => s.melodyVoiceVisible);
  const setMelodyVoiceVisible = useUIStore((s) => s.setMelodyVoiceVisible);
  const inactiveMelodyDisplayMode = useUIStore((s) => s.inactiveMelodyDisplayMode);
  const setInactiveMelodyDisplayMode = useUIStore((s) => s.setInactiveMelodyDisplayMode);
  const smartOctaveEnabled = useUIStore((s) => s.smartOctaveEnabled);
  const setSmartOctaveEnabled = useUIStore((s) => s.setSmartOctaveEnabled);

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-border,#E5E7EB)] px-3 py-3">
      <h3 className="text-base font-semibold text-[var(--color-text-primary,#111827)]">Melody</h3>

      <div className="flex flex-col gap-2">
        <p id="melody-active-voice-label" className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">
          Active voice
        </p>
        <div
          role="radiogroup"
          aria-labelledby="melody-active-voice-label"
          className="flex flex-wrap gap-2"
        >
          {([0, 1, 2, 3] as const).map((v) => (
            <button
              key={v}
              type="button"
              data-testid={`properties-melody-active-voice-${v}`}
              role="radio"
              aria-checked={activeVoice === v}
              onClick={() => setActiveVoice(v)}
              className={
                activeVoice === v
                  ? 'inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-[var(--color-primary,#4F46E5)] bg-[var(--color-surface-muted,#F9FAFB)] text-sm font-semibold text-[var(--color-text-primary,#111827)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
                  : 'inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] text-sm font-medium text-[var(--color-text-secondary,#4B5563)] outline-none hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
              }
            >
              {v + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">Voice visibility</p>
        <div className="flex flex-col gap-2">
          {([0, 1, 2, 3] as const).map((v) => (
            <label
              key={v}
              className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-primary,#111827)]"
            >
              <input
                type="checkbox"
                data-testid={`properties-melody-voice-${v}-visible`}
                checked={melodyVoiceVisible[v]}
                onChange={() => setMelodyVoiceVisible(v, !melodyVoiceVisible[v])}
                className="h-[18px] w-[18px] shrink-0 rounded border border-[var(--color-border-strong,#D1D5DB)] text-[var(--color-primary,#4F46E5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)]"
              />
              <span>Show lane {v + 1}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="properties-inactive-melody-display-mode" className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">
          Inactive voices
        </label>
        <select
          id="properties-inactive-melody-display-mode"
          data-testid="properties-inactive-melody-display-mode"
          value={inactiveMelodyDisplayMode}
          onChange={(e) =>
            setInactiveMelodyDisplayMode(e.target.value as (typeof INACTIVE_MODES)[number])
          }
          className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
        >
          {INACTIVE_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-primary,#111827)]">
          <input
            type="checkbox"
            data-testid="properties-smart-octave"
            checked={smartOctaveEnabled}
            onChange={() => setSmartOctaveEnabled(!smartOctaveEnabled)}
            className="h-[18px] w-[18px] shrink-0 rounded border border-[var(--color-border-strong,#D1D5DB)] text-[var(--color-primary,#4F46E5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)]"
          />
          <span>Smart octave</span>
        </label>
        <p className="text-[12px] text-[var(--color-text-muted,#9CA3AF)]">
          New notes pick an octave near the previous pitch in the same voice.
        </p>
      </div>
    </div>
  );
}
