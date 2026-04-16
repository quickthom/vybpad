import type { ReactElement } from 'react';

/** PAT-004 tick presets surfaced in the left panel (UI-W3). */
const PRESETS: ReadonlyArray<{ ticks: number; label: string }> = [
  { ticks: 192, label: '1' },
  { ticks: 96, label: '1/2' },
  { ticks: 48, label: '1/4' },
  { ticks: 24, label: '1/8' },
  { ticks: 12, label: '1/16' },
];

export interface PlacementDurationControlsProps {
  currentDurationTicks: number;
  onDurationTicks: (ticks: number) => void;
}

/**
 * Shared placement duration for chord palette + melody entry (RA-5). Ticks follow PAT-004 / INTERFACES `ShortcutCommandId` duration row.
 */
export function PlacementDurationControls(props: PlacementDurationControlsProps): ReactElement {
  const { currentDurationTicks, onDurationTicks } = props;

  return (
    <section
      className="flex shrink-0 flex-col gap-2 border-b border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 py-2"
      aria-label="Placement duration"
    >
      <h3 className="text-base font-semibold tracking-tight text-[var(--color-text-primary,#111827)]">
        Duration
      </h3>
      <p className="text-xs text-[var(--color-text-muted,#9CA3AF)]" aria-live="polite">
        Next note or chord: <span className="font-mono text-[var(--color-text-secondary,#4B5563)]">{currentDurationTicks}</span> ticks
      </p>
      <div className="flex flex-col gap-1.5" role="group" aria-label="Duration presets">
        {PRESETS.map(({ ticks, label }) => (
          <button
            key={ticks}
            type="button"
            data-testid={`left-panel-duration-ticks-${ticks}`}
            aria-pressed={currentDurationTicks === ticks}
            onClick={() => onDurationTicks(ticks)}
            className={
              currentDurationTicks === ticks
                ? 'inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--color-primary,#4F46E5)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
                : 'inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
            }
          >
            {label} ({ticks} tk)
          </button>
        ))}
      </div>
    </section>
  );
}
