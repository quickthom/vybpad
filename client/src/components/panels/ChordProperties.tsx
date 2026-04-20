import type { ChordEvent, NoteName, ScaleDegree, ScaleType, SecondaryChord } from '@vybpad/shared';
import type { ReactElement } from 'react';

import { theoryEngine } from '../../engine/theory';

const QUALITIES: readonly { value: ChordEvent['quality']; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'diminished', label: 'Dim' },
  { value: 'augmented', label: 'Aug' },
] as const;

const SEVENTHS: readonly { value: ChordEvent['seventh']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'maj7', label: 'Maj7' },
  { value: 'min7', label: 'Min7' },
  { value: 'dom7', label: '7' },
  { value: 'dim7', label: 'Dim7' },
  { value: 'min7b5', label: 'm7b5' },
] as const;

const INVERSIONS: readonly { value: 0 | 1 | 2 | 3; label: string }[] = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
] as const;

const EMBELLISHMENTS: readonly {
  kind: 'suspension' | 'addition';
  value: ChordEvent['suspension'] | ChordEvent['addition'];
  label: string;
}[] = [
  { kind: 'suspension', value: 'sus2', label: 'Sus2' },
  { kind: 'suspension', value: 'sus4', label: 'Sus4' },
  { kind: 'addition', value: 'add9', label: 'Add9' },
  { kind: 'addition', value: 'add11', label: 'Add11' },
  { kind: 'addition', value: 'add13', label: 'Add13' },
] as const;

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

function buttonPressedClass(isPressed: boolean): string {
  return isPressed
    ? 'border-[var(--color-primary,#4F46E5)] bg-[var(--color-surface-muted,#F9FAFB)] text-[var(--color-text-primary,#111827)]'
    : 'border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] text-[var(--color-text-primary,#111827)]';
}

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

function inversionState(chord: ChordEvent): 0 | 1 | 2 | 3 {
  return chord.seventh === 'none' && chord.inversion === 3 ? 0 : chord.inversion;
}

function maxInversion(chord: ChordEvent): 2 | 3 {
  return chord.seventh === 'none' ? 2 : 3;
}

export interface ChordPropertiesProps {
  chord: ChordEvent;
  /** Key + scale at the chord’s measure (Roman / names). */
  currentKey: NoteName;
  theoryScale: ScaleType;
  onUpdate: (changes: Partial<ChordEvent>) => void;
  /** UI-W7 — same edit path as `d` / keyboard; omit to hide secondary action row. */
  onSecondaryCycle?: () => void;
  onSecondaryClear?: () => void;
}

/**
 * UI-W4 — selected chord inspector; dispatches partial updates (INTERFACES `ChordEditAction` update).
 */
export function ChordProperties({
  chord,
  currentKey,
  theoryScale,
  onUpdate,
  onSecondaryCycle,
  onSecondaryClear,
}: ChordPropertiesProps): ReactElement {
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

  const romanLabel = theoryEngine.toRomanNumeral(chord, theoryScale);

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <h3 className="text-base font-semibold text-[var(--color-text-primary,#111827)]">Chord</h3>
      <p
        data-testid="properties-chord-roman"
        aria-live="polite"
        className="text-sm font-semibold text-[var(--color-text-primary,#111827)]"
      >
        {romanLabel}
      </p>
      <p className="text-xs text-[var(--color-text-secondary,#4B5563)]">
        {currentKey} · {theoryEngine.toChordName(chord, currentKey, theoryScale)}
      </p>

      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">Chord type</p>
        <div
          role="group"
          aria-label="Chord type"
          className="grid grid-cols-2 gap-2"
          data-testid="properties-chord-quality"
        >
          {QUALITIES.map((option) => {
            const pressed = chord.quality === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={pressed}
                aria-label={`chord type ${option.label}`}
                onClick={() => {
                  if (!pressed) {
                    mergeAndDispatch({ quality: option.value });
                  }
                }}
                className={`inline-flex h-9 min-h-0 shrink-0 items-center justify-center rounded-md border px-3 text-sm font-medium outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 ${buttonPressedClass(
                  pressed,
                )}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">Seventh family</p>
        <div
          role="group"
          aria-label="Chord seventh"
          className="grid grid-cols-3 gap-2"
          data-testid="properties-chord-seventh"
        >
          {SEVENTHS.map((option) => {
            const pressed = chord.seventh === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={pressed}
                aria-label={`chord seventh ${option.label}`}
                onClick={() => {
                  if (pressed) return;
                  const next: Partial<ChordEvent> = { seventh: option.value };
                  if (option.value === 'none' && chord.inversion === 3) {
                    next.inversion = 0;
                  }
                  mergeAndDispatch(next);
                }}
                className={`inline-flex h-9 min-h-0 shrink-0 items-center justify-center rounded-md border px-3 text-sm font-medium outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 ${buttonPressedClass(
                  pressed,
                )}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">Inversion</p>
        <div
          role="group"
          aria-label="Inversion"
          className="grid grid-cols-4 gap-2"
          data-testid="properties-chord-inversion"
        >
          {INVERSIONS.map((option) => {
            const disabled = triad && option.value === 3;
            const pressed = inversionState(chord) === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                aria-disabled={disabled || undefined}
                aria-pressed={pressed}
                aria-label={`inversion ${option.label}`}
                onClick={() => {
                  if (disabled || pressed) {
                    return;
                  }
                  if (option.value > invMax) {
                    return;
                  }
                  mergeAndDispatch({ inversion: option.value });
                }}
                className={`inline-flex h-9 min-h-0 shrink-0 items-center justify-center rounded-md border px-3 text-sm font-medium outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 ${
                  disabled ? 'cursor-not-allowed opacity-50' : buttonPressedClass(pressed)
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">Options</p>
        <div
          role="group"
          aria-label="Options"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          data-testid="properties-chord-options"
        >
          {EMBELLISHMENTS.map((option) => {
            const checked =
              option.kind === 'suspension'
                ? chord.suspension === option.value
                : chord.addition === option.value;
            const label = `${option.label}`;
            return (
              <label
                key={`${option.kind}-${option.value}`}
                className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 py-2 text-sm text-[var(--color-text-primary,#111827)]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    if (option.kind === 'suspension') {
                      mergeAndDispatch({
                        suspension: checked ? 'none' : (option.value as ChordEvent['suspension']),
                      });
                    } else {
                      mergeAndDispatch({
                        addition: checked ? 'none' : (option.value as ChordEvent['addition']),
                      });
                    }
                  }}
                  aria-label={label}
                  className="h-[18px] w-[18px] border-[var(--color-border-strong,#D1D5DB)]"
                />
                {label}
              </label>
            );
          })}
        </div>
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

      {onSecondaryCycle != null && onSecondaryClear != null ? (
        <div className="flex flex-col gap-2 border-t border-[var(--color-border,#E5E7EB)] pt-4">
          <p className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">Secondary actions</p>
          <p className="text-xs text-[var(--color-text-secondary,#4B5563)]">
            Mirrors the <kbd className="rounded bg-[var(--color-surface-muted,#F9FAFB)] px-1 font-mono text-[11px]">d</kbd> key for undo-consistent edits.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="properties-chord-secondary-cycle"
              onClick={onSecondaryCycle}
              className="inline-flex h-9 min-h-0 shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium text-[var(--color-primary,#4F46E5)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            >
              Cycle secondary (d)
            </button>
            <button
              type="button"
              data-testid="properties-chord-secondary-clear"
              disabled={chord.secondary == null}
              onClick={onSecondaryClear}
              className="inline-flex h-9 min-h-0 shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium text-[var(--color-text-secondary,#4B5563)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              Clear to diatonic
            </button>
          </div>
        </div>
      ) : null}

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
