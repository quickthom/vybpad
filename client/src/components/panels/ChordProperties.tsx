import type { ChordEvent, ScaleDegree, ScaleType, SecondaryChord } from '@vybpad/shared';
import type { ReactElement } from 'react';

import { useToastStore } from '../../store/toastStore';

const QUALITIES: ChordEvent['quality'][] = ['major', 'minor', 'diminished', 'augmented'];
const SEVENTHS: ChordEvent['seventh'][] = ['none', 'maj7', 'min7', 'dom7', 'dim7', 'min7b5'];
const SUSPENSIONS: ChordEvent['suspension'][] = ['none', 'sus2', 'sus4'];
const ADDITIONS: ChordEvent['addition'][] = ['none', 'add9', 'add11', 'add13'];
const INVERSIONS: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];

const BORROW_SCALES: ScaleType[] = [
  'major',
  'minor',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'locrian',
  'harmonicMinor',
  'phrygianDominant',
];

const SECONDARY_FN = ['V', 'viio', 'IV'] as const;

function secondaryToValue(sec: SecondaryChord | null): string {
  if (sec == null) return 'none';
  return `${sec.function}:${sec.target}`;
}

function parseSecondaryValue(raw: string): SecondaryChord | null {
  if (raw === 'none') return null;
  const idx = raw.indexOf(':');
  if (idx <= 0) return null;
  const fn = raw.slice(0, idx);
  const t = Number(raw.slice(idx + 1));
  if (!Number.isInteger(t) || t < 1 || t > 7) return null;
  if (fn === 'V') return { function: 'V', target: t as ScaleDegree };
  if (fn === 'viio') return { function: 'viio', target: t as ScaleDegree };
  if (fn === 'IV') return { function: 'IV', target: t as ScaleDegree };
  return null;
}

function maxInversion(chord: ChordEvent): 2 | 3 {
  return chord.seventh === 'none' ? 2 : 3;
}

export interface ChordPropertiesProps {
  chord: ChordEvent;
  onUpdate: (changes: Partial<ChordEvent>) => void;
}

/**
 * UI-W4 — selected chord inspector; dispatches partial updates (INTERFACES `ChordEditAction` update).
 */
export function ChordProperties({ chord, onUpdate }: ChordPropertiesProps): ReactElement {
  const showError = useToastStore((s) => s.showError);

  const triad = chord.seventh === 'none';
  const invMax = maxInversion(chord);

  const mergeAndDispatch = (changes: Partial<ChordEvent>): void => {
    const merged = { ...chord, ...changes };
    if (merged.seventh === 'none' && merged.inversion === 3) {
      onUpdate({ ...changes, inversion: 0 });
      return;
    }
    onUpdate(changes);
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h3 className="text-base font-semibold text-[var(--color-text-primary,#111827)]">Chord</h3>

      <div className="flex flex-col gap-2">
        <label htmlFor="properties-chord-quality" className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">
          Quality
        </label>
        <select
          id="properties-chord-quality"
          data-testid="properties-chord-quality"
          value={chord.quality}
          onChange={(e) => mergeAndDispatch({ quality: e.target.value as ChordEvent['quality'] })}
          className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
        >
          {QUALITIES.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="properties-chord-seventh" className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">
          Seventh
        </label>
        <select
          id="properties-chord-seventh"
          data-testid="properties-chord-seventh"
          value={chord.seventh}
          onChange={(e) => {
            const seventh = e.target.value as ChordEvent['seventh'];
            const next: Partial<ChordEvent> = { seventh };
            if (seventh === 'none' && chord.inversion === 3) {
              next.inversion = 0;
            }
            mergeAndDispatch(next);
          }}
          className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
        >
          {SEVENTHS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="properties-chord-suspension" className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">
          Suspension
        </label>
        <select
          id="properties-chord-suspension"
          data-testid="properties-chord-suspension"
          value={chord.suspension}
          onChange={(e) => mergeAndDispatch({ suspension: e.target.value as ChordEvent['suspension'] })}
          className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
        >
          {SUSPENSIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="properties-chord-addition" className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">
          Addition
        </label>
        <select
          id="properties-chord-addition"
          data-testid="properties-chord-addition"
          value={chord.addition}
          onChange={(e) => mergeAndDispatch({ addition: e.target.value as ChordEvent['addition'] })}
          className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
        >
          {ADDITIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="properties-chord-inversion" className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">
          Inversion
        </label>
        <select
          id="properties-chord-inversion"
          data-testid="properties-chord-inversion"
          value={chord.inversion > invMax ? invMax : chord.inversion}
          onChange={(e) => {
            const v = Number(e.target.value) as 0 | 1 | 2 | 3;
            if (triad && v === 3) {
              showError('Third inversion requires a seventh chord.');
              return;
            }
            mergeAndDispatch({ inversion: v });
          }}
          className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
        >
          {INVERSIONS.map((i) => (
            <option key={i} value={i} disabled={triad && i === 3}>
              {i}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="properties-chord-secondary" className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">
          Secondary
        </label>
        <select
          id="properties-chord-secondary"
          data-testid="properties-chord-secondary"
          value={secondaryToValue(chord.secondary)}
          onChange={(e) => {
            const parsed = parseSecondaryValue(e.target.value);
            mergeAndDispatch({ secondary: parsed });
          }}
          className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
        >
          <option value="none">None</option>
          {SECONDARY_FN.flatMap((fn) =>
            ([1, 2, 3, 4, 5, 6, 7] as const).map((t) => {
              const val = `${fn}:${t}`;
              return (
                <option key={val} value={val} data-secondary={`${fn}|${t}`}>
                  {fn}/{t}
                </option>
              );
            }),
          )}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="properties-chord-borrow" className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">
          Borrowed mode
        </label>
        <select
          id="properties-chord-borrow"
          data-testid="properties-chord-borrow"
          value={chord.borrowed ?? 'none'}
          onChange={(e) => {
            const v = e.target.value;
            mergeAndDispatch({ borrowed: v === 'none' ? null : (v as ScaleType) });
          }}
          className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
        >
          <option value="none">None</option>
          {BORROW_SCALES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
