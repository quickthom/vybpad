import type { ChordEvent, NoteName, ScaleDegree, ScaleType } from '@vybpad/shared';
import type { ReactElement } from 'react';

import { theoryEngine } from '../../engine/theory';
import { pat010DiatonicHex } from '../../engine/renderer/colorMaps';

/** INTERFACES.md — ChordPaletteProps */
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

const DIATONIC_DEGREES = [1, 2, 3, 4, 5, 6, 7] as const satisfies readonly ScaleDegree[];

/**
 * Left-panel diatonic chord palette (UX §7). Scale-degree buttons emit theory fields consistent with
 * `buildDiatonicChordPayload` / `theoryEngine.getDiatonicQuality` + `getDiatonicSeventh`.
 */
export function ChordPalette(props: ChordPaletteProps): ReactElement {
  const { currentKey, currentScale, onChordSelect, mode } = props;

  if (mode !== 'diatonic') {
    return (
      <div
        data-testid="chord-palette-root"
        className="flex h-full min-h-0 w-72 min-w-[288px] flex-col bg-[var(--color-surface,#FFFFFF)] px-4 py-3"
      >
        <h3 className="text-base font-semibold text-[var(--color-text-primary,#111827)]">Chord palette</h3>
        <p className="mt-3 text-sm text-[var(--color-text-secondary,#4B5563)]">
          {mode === 'borrowed' && 'Borrowed chords — coming later.'}
          {mode === 'secondary' && 'Secondary dominants — coming later.'}
          {mode === 'search' && 'Chord search — coming later.'}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="chord-palette-root"
      role="region"
      aria-label="Chord palette"
      className="flex h-full min-h-0 w-72 min-w-[288px] flex-col bg-[var(--color-surface,#FFFFFF)] px-4 py-3"
    >
      <h3 className="text-base font-semibold tracking-tight text-[var(--color-text-primary,#111827)]">Chord palette</h3>
      <p className="mt-1 text-xs text-[var(--color-text-muted,#9CA3AF)]">
        {currentKey} · {currentScale} · diatonic
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Diatonic scale degrees">
        {DIATONIC_DEGREES.map((deg) => {
          const fill = pat010DiatonicHex(deg);
          const roman = theoryEngine.toRomanNumeral(
            {
              id: 'palette-preview',
              scaleDegree: deg,
              quality: theoryEngine.getDiatonicQuality(deg, currentScale),
              seventh: theoryEngine.getDiatonicSeventh(deg, currentScale),
              suspension: 'none',
              addition: 'none',
              inversion: 0,
              borrowed: null,
              secondary: null,
              beat: 0,
              duration: 48,
            },
            currentScale,
          );
          return (
            <button
              key={deg}
              type="button"
              data-testid={`chord-palette-degree-${deg}`}
              tabIndex={0}
              className="flex min-h-[44px] flex-col items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] px-2 py-2 text-center outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
              style={{
                backgroundImage: `linear-gradient(${fill}CC, ${fill}CC), linear-gradient(var(--color-surface,#FFFFFF), var(--color-surface,#FFFFFF))`,
              }}
              aria-label={`Add diatonic chord, degree ${deg}, ${roman}`}
              onClick={() =>
                onChordSelect({
                  scaleDegree: deg,
                  quality: theoryEngine.getDiatonicQuality(deg, currentScale),
                  seventh: theoryEngine.getDiatonicSeventh(deg, currentScale),
                  suspension: 'none',
                  addition: 'none',
                  inversion: 0,
                  borrowed: null,
                  secondary: null,
                })
              }
            >
              <span className="text-sm font-semibold text-[var(--color-text-primary,#111827)]">{deg}</span>
              <span className="mt-0.5 text-xs font-medium text-[var(--color-text-secondary,#4B5563)]">
                {roman}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
