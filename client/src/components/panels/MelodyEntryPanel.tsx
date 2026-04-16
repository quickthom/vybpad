import type { NoteName, ScaleDegree, ScaleType } from '@vybpad/shared';
import { useState, type ReactElement } from 'react';

import { scaleDegreeToMidi } from '../../engine/theory/scaleDegreeToMidi';

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

function pitchClassButtonId(degree: ScaleDegree, key: NoteName, scale: ScaleType): string {
  const midi = scaleDegreeToMidi(degree, 0, 0, key, scale, 4);
  const pc = ((midi % 12) + 12) % 12;
  return PC_NAMES[pc] ?? 'X';
}

export interface MelodyEntryPanelProps {
  currentKey: NoteName;
  currentScale: ScaleType;
  entryMode: 'table' | 'text';
  onPitchDegree: (degree: ScaleDegree) => void;
  onRest: () => void;
  onRaiseHalf: () => void;
  onLowerHalf: () => void;
}

const DIATONIC_DEGREES: ScaleDegree[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Left-panel diatonic pitch classes + rest + chromatic toggle + raise/lower (RA-6 / UI-W3). Placement uses the same
 * store paths as the grid keyboard via {@link applyMelodyPitchDegreeFromEditor} in the shell.
 */
export function MelodyEntryPanel(props: MelodyEntryPanelProps): ReactElement | null {
  const { currentKey, currentScale, entryMode, onPitchDegree, onRest, onRaiseHalf, onLowerHalf } = props;
  const [chromaticOn, setChromaticOn] = useState(false);

  if (entryMode !== 'table') {
    return null;
  }

  return (
    <section
      className="flex shrink-0 flex-col gap-3 border-b border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-4 py-3"
      aria-label="Melody note entry"
    >
      <h3 className="text-base font-semibold tracking-tight text-[var(--color-text-primary,#111827)]">Melody</h3>
      <p className="text-xs text-[var(--color-text-muted,#9CA3AF)]">
        Notes in {currentKey} {currentScale}
      </p>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Diatonic pitch classes">
        {DIATONIC_DEGREES.map((deg) => {
          const id = pitchClassButtonId(deg, currentKey, currentScale);
          return (
            <button
              key={deg}
              type="button"
              data-testid={`melody-entry-pitch-${id}`}
              aria-label={`Add melody note scale degree ${deg}, pitch class ${id}`}
              onClick={() => onPitchDegree(deg)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] text-sm font-semibold text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            >
              {id}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        data-testid="melody-entry-rest"
        aria-label="Add rest"
        onClick={onRest}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-dashed border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 text-sm font-medium text-[var(--color-text-secondary,#4B5563)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
      >
        Rest
      </button>
      <button
        type="button"
        data-testid="melody-entry-chromatic-toggle"
        aria-pressed={chromaticOn}
        aria-label="Chromatic spelling"
        onClick={() => setChromaticOn((v) => !v)}
        className={
          chromaticOn
            ? 'inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--color-primary,#4F46E5)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
            : 'inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
        }
      >
        Chromatic
      </button>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Chromatic nudge selection">
        <button
          type="button"
          data-testid="melody-entry-raise-half"
          aria-label="Raise selection by half step"
          onClick={onRaiseHalf}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
        >
          Raise
        </button>
        <button
          type="button"
          data-testid="melody-entry-lower-half"
          aria-label="Lower selection by half step"
          onClick={onLowerHalf}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
        >
          Lower
        </button>
      </div>
    </section>
  );
}
