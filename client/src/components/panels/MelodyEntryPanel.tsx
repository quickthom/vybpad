import type { NoteName, ScaleDegree, ScaleType } from '@vybpad/shared';
import type { ReactElement } from 'react';

import { scaleDegreeToMidi } from '../../engine/theory/scaleDegreeToMidi';
import { pat010DiatonicHex } from '../../engine/renderer/colorMaps';

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
  /** UI-W3 — shared with {@link EditorKeyboardContext.melodyChromaticEntryActive} via EditorLayout. */
  melodyChromaticEntryActive: boolean;
  onMelodyChromaticEntryToggle: () => void;
  onPitchDegree: (degree: ScaleDegree) => void;
  onRest: () => void;
  onRaiseHalf: () => void;
  onRaise: () => void;
  onRaiseOctave: () => void;
  onLowerHalf: () => void;
  onLower: () => void;
  onLowerOctave: () => void;
  onAdd: () => void;
  onSplit: () => void;
  onTie: () => void;
}

const DIATONIC_DEGREES: ScaleDegree[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Left-panel diatonic pitch classes + rest + chromatic toggle + raise/lower (RA-6 / UI-W3). Placement uses the same
 * store paths as the grid keyboard via {@link applyMelodyPitchDegreeFromEditor} in the shell.
 */
export function MelodyEntryPanel(props: MelodyEntryPanelProps): ReactElement | null {
  const {
    currentKey,
    currentScale,
    entryMode,
    melodyChromaticEntryActive,
    onMelodyChromaticEntryToggle,
    onPitchDegree,
    onRest,
    onRaiseHalf,
    onRaise,
    onRaiseOctave,
    onLowerHalf,
    onLower,
    onLowerOctave,
    onAdd,
    onSplit,
    onTie,
  } = props;

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
          const fill = pat010DiatonicHex(deg);
          return (
            <button
              key={deg}
              type="button"
              data-testid={`melody-entry-pitch-${id}`}
              aria-label={`Add melody note scale degree ${deg}, pitch class ${id}`}
              onClick={() => onPitchDegree(deg)}
              className="inline-flex min-h-8 min-w-11 items-center justify-center rounded-lg border text-sm font-semibold text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:brightness-[1.08] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
              style={{
                borderColor: fill,
                backgroundColor: `${fill}24`,
                backgroundImage: `linear-gradient(90deg, ${fill}33 0, ${fill}33 4px, transparent 4px), linear-gradient(var(--color-surface,#FFFFFF), var(--color-surface,#FFFFFF))`,
              }}
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
        className="inline-flex min-h-8 items-center justify-center rounded-lg border border-dashed border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 text-sm font-medium text-[var(--color-text-secondary,#4B5563)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
      >
        Rest
      </button>
      <button
        type="button"
        data-testid="melody-entry-chromatic-toggle"
        aria-pressed={melodyChromaticEntryActive}
        aria-label="Chromatic entry: new notes default one semitone sharp (PAT-018)"
        onClick={onMelodyChromaticEntryToggle}
        className={
          melodyChromaticEntryActive
            ? 'inline-flex min-h-8 items-center justify-center rounded-lg border border-[var(--color-primary,#4F46E5)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
            : 'inline-flex min-h-8 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
        }
      >
        Chromatic
      </button>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Raise note by half">
        <button
          type="button"
          data-testid="melody-entry-raise-half"
          aria-label="Raise selection by half-step"
          onClick={onRaiseHalf}
          className="inline-flex min-h-8 flex-1 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
        >
          Raise Half
        </button>
        <button
          type="button"
          data-testid="melody-entry-raise-diatonic"
          aria-label="Raise selection by diatonic step"
          onClick={onRaise}
          className="inline-flex min-h-8 flex-1 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
        >
          Raise
        </button>
        <button
          type="button"
          data-testid="melody-entry-raise-octave"
          aria-label="Raise selection by octave"
          onClick={onRaiseOctave}
          className="inline-flex min-h-8 flex-1 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
        >
          Raise Octave
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Lower note">
        <button
          type="button"
          data-testid="melody-entry-lower-half"
          aria-label="Lower selection by half-step"
          onClick={onLowerHalf}
          className="inline-flex min-h-8 flex-1 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
        >
          Lower Half
        </button>
        <button
          type="button"
          data-testid="melody-entry-lower-diatonic"
          aria-label="Lower selection by diatonic step"
          onClick={onLower}
          className="inline-flex min-h-8 flex-1 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
        >
          Lower
        </button>
        <button
          type="button"
          data-testid="melody-entry-lower-octave"
          aria-label="Lower selection by octave"
          onClick={onLowerOctave}
          className="inline-flex min-h-8 flex-1 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
        >
          Lower Octave
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Add, split, and tie">
        <button
          type="button"
          data-testid="melody-entry-add"
          aria-label="Add a note or rest at current note position"
          onClick={onAdd}
          className="inline-flex min-h-8 flex-1 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
        >
          Add
        </button>
        <button
          type="button"
          data-testid="melody-entry-split"
          aria-label="Split selected note into two equal parts"
          onClick={onSplit}
          className="inline-flex min-h-8 flex-1 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
        >
          Split
        </button>
        <button
          type="button"
          data-testid="melody-entry-tie"
          aria-label="Tie selected adjacent notes"
          onClick={onTie}
          className="inline-flex min-h-8 flex-1 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
        >
          Tie
        </button>
      </div>
    </section>
  );
}
