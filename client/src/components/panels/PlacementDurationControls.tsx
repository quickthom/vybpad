import type { ReactElement } from 'react';

/** PAT-004 tick presets surfaced in the left panel (UI-W3). */
const PRESETS: ReadonlyArray<{ ticks: number; label: string }> = [
  { ticks: 192, label: '4' },
  { ticks: 96, label: '2' },
  { ticks: 48, label: '1' },
  { ticks: 24, label: '1/2' },
  { ticks: 12, label: '1/4' },
];
const MAX_PRESET_TICKS = PRESETS[0]?.ticks ?? 192;

function ticksToBeatLabel(ticks: number): string {
  const found = PRESETS.find((preset) => preset.ticks === ticks);
  if (found) return found.label;
  if (Number.isFinite(ticks) && Number.isInteger(ticks) && ticks > 0) {
    const asQuarter = ticks / 48;
    if (Number.isInteger(asQuarter)) return String(asQuarter);
    return asQuarter.toString();
  }
  return String(ticks);
}

export interface PlacementDurationControlsProps {
  currentDurationTicks: number;
  onDurationTicks: (ticks: number) => void;
}

/**
 * Shared placement duration for chord palette + melody entry (RA-5).
 * Emits canonical ticks to the editor but renders beats-first labels for UX.
 */
export function PlacementDurationControls(props: PlacementDurationControlsProps): ReactElement {
  const { currentDurationTicks, onDurationTicks } = props;
  const activeLabel = ticksToBeatLabel(currentDurationTicks);

  return (
    <section
      className="flex shrink-0 flex-col gap-2 border-b border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 py-2"
      aria-label="Placement duration"
    >
      <h3 className="text-base font-semibold tracking-tight text-[var(--color-text-primary,#111827)]">Duration</h3>
      <p className="text-xs text-[var(--color-text-muted,#9CA3AF)]" aria-live="polite">
        Next note or chord: {activeLabel}
      </p>
      <div className="flex flex-col gap-1.5" role="group" aria-label="Duration presets">
        {PRESETS.map(({ ticks, label }) => {
          const isActive = currentDurationTicks === ticks;
          const widthPercent = (ticks / MAX_PRESET_TICKS) * 100;
          return (
            <button
              key={ticks}
              type="button"
              data-testid={`left-panel-duration-ticks-${ticks}`}
              aria-pressed={isActive}
              aria-label={`${label} beats (${ticks} ticks)`}
              onClick={() => onDurationTicks(ticks)}
              className={
                isActive
                  ? 'inline-flex w-full min-h-9 flex-col items-start justify-center gap-1 rounded-lg border border-[var(--color-primary,#4F46E5)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
                  : 'inline-flex w-full min-h-9 flex-col items-start justify-center gap-1 rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
              }
            >
              <span className="text-xs font-medium text-[var(--color-text-primary,#111827)]">{label}</span>
              <span
                aria-hidden="true"
                className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted,#F9FAFB)]"
              >
                <span
                  data-testid={`left-panel-duration-bar-${ticks}`}
                  className={
                    isActive
                      ? 'h-full rounded-full bg-[var(--color-primary,#4F46E5)] transition-[width] duration-150'
                      : 'h-full rounded-full bg-[var(--color-text-secondary,#4B5563)] transition-[width] duration-150'
                  }
                  style={{ width: `${widthPercent}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
