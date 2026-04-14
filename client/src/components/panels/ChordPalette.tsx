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

const DIATONIC_DEGREES = [1, 2, 3, 4, 5, 6, 7] as const satisfies readonly ScaleDegree[];

/**
 * Left-panel diatonic chord palette (UX §7). Scale-degree buttons emit theory fields consistent with
 * `buildDiatonicChordPayload` / `theoryEngine.getDiatonicQuality` + `getDiatonicSeventh`.
 */
export function ChordPalette(props: ChordPaletteProps): ReactElement {
  const { currentKey, currentScale, onChordSelect, mode } = props;

  if (mode !== 'diatonic') {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-[var(--color-surface,#FFFFFF)] px-4 py-3">
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
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-[var(--color-surface,#FFFFFF)] px-4 py-3">
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
