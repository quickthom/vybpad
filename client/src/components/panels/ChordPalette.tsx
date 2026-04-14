import type { ChordEvent, NoteName, ScaleType } from '@vybpad/shared';
import type { ReactElement } from 'react';

/**
 * INTERFACES.md — ChordPalette. Phase 5.3 ships the `secondary` affordance; other modes are placeholders
 * until tasks 5.1–5.2 land.
 */
export interface ChordPaletteProps {
  currentKey: NoteName;
  currentScale: ScaleType;
  onChordSelect: (chord: Omit<ChordEvent, 'id' | 'beat' | 'duration'>) => void;
  mode: 'diatonic' | 'borrowed' | 'secondary' | 'search';
}

export type SecondaryChordInspectorProps = {
  /** Selected chord block, if any. */
  chord: ChordEvent | null;
  romanLabel: string;
  onCycle: () => void;
  onClear: () => void;
};

/**
 * TASK-5.3 — Minimal left-rail inspector (UX §7): cycle / clear mirror the `d` key and use the same
 * `ChordEditAction` path as the keyboard for undo consistency.
 */
export function SecondaryChordInspector(props: SecondaryChordInspectorProps): ReactElement {
  const { chord, romanLabel, onCycle, onClear } = props;
  const hasChord = chord != null;

  return (
    <section
      className="flex flex-col gap-3 border-b border-[var(--color-border,#E5E7EB)] px-4 py-3"
      aria-label="Secondary chords"
    >
      <h3 className="text-base font-semibold text-[var(--color-text-primary,#111827)]">Applied chords</h3>
      <p className="text-sm text-[var(--color-text-secondary,#4B5563)]">
        Press <kbd className="rounded bg-[var(--color-surface-muted,#F9FAFB)] px-1.5 py-0.5 font-mono text-xs">d</kbd> with
        a chord selected to cycle legal V/x, viio/x, and IV/x slots (see getSecondaryCycleSequence).
      </p>
      <div className="min-h-[3rem] rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted,#9CA3AF)]">
          Roman
        </p>
        <p className="font-mono text-sm text-[var(--color-text-primary,#111827)]" aria-live="polite">
          {hasChord ? romanLabel : '—'}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!hasChord}
          onClick={onCycle}
          className="inline-flex h-11 min-h-11 items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-4 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none transition hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          Cycle secondary (d)
        </button>
        <button
          type="button"
          disabled={!hasChord || chord?.secondary == null}
          onClick={onClear}
          className="inline-flex h-11 min-h-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          Clear to diatonic
        </button>
      </div>
    </section>
  );
}

export function ChordPalette(props: ChordPaletteProps): ReactElement {
  const { mode, currentKey, currentScale, onChordSelect } = props;
  void currentKey;
  void currentScale;
  void onChordSelect;
  if (mode === 'diatonic') {
    return (
      <div className="px-4 py-3">
        <h3 className="text-base font-semibold text-[var(--color-text-primary,#111827)]">Diatonic chords</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary,#4B5563)]">Coming in task 5.1.</p>
      </div>
    );
  }
  if (mode === 'borrowed' || mode === 'search') {
    return (
      <div className="px-4 py-3">
        <h3 className="text-base font-semibold text-[var(--color-text-primary,#111827)]">
          {mode === 'borrowed' ? 'Borrowed chords' : 'Chord search'}
        </h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary,#4B5563)]">Coming in tasks 5.1–5.2.</p>
      </div>
    );
  }
  return (
    <div className="px-4 py-3">
      <h3 className="text-base font-semibold text-[var(--color-text-primary,#111827)]">Chord palette</h3>
      <p className="mt-2 text-sm text-[var(--color-text-secondary,#4B5563)]">
        Secondary (applied) chord tools use the inspector below.
      </p>
    </div>
  );
}
