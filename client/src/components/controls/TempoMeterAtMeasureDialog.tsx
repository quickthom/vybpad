import type { MeasureChanges, SongData, TimeSignature } from '@vybpad/shared';
import { useEffect, useId, useState } from 'react';

import { getMeterAtMeasure, getTempoAtMeasure } from '../../engine/renderer/tickUtils';
import { useToastStore } from '../../store/toastStore';
import { isValidMeter, isValidTempo } from '../../utils/measureChangeValidation';

export interface TempoMeterAtMeasureDialogProps {
  open: boolean;
  measureIndex: number;
  song: SongData;
  onDismiss: () => void;
  /** Called with validated patch; parent applies via `setMeasureChanges`. */
  onApply: (changes: MeasureChanges) => void;
}

const DENOM_OPTIONS = [1, 2, 4, 8, 16, 32] as const;

/**
 * TASK-5.6: measure-level tempo + meter (INTERFACES `MeasureChanges`); UX §5.8 ghost/modal pattern.
 */
export function TempoMeterAtMeasureDialog({
  open,
  measureIndex,
  song,
  onDismiss,
  onApply,
}: TempoMeterAtMeasureDialogProps) {
  const titleId = useId();
  const showErrorToast = useToastStore((s) => s.showError);
  const [tempoStr, setTempoStr] = useState('');
  const [numStr, setNumStr] = useState('4');
  const [denStr, setDenStr] = useState('4');
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const effT = getTempoAtMeasure(song, measureIndex);
    const m = getMeterAtMeasure(song, measureIndex);
    setTempoStr(String(effT));
    setNumStr(String(m.numerator));
    setDenStr(String(m.denominator));
    setInlineError(null);
  }, [open, measureIndex, song]);

  if (!open) {
    return null;
  }

  const displayMeasure = measureIndex + 1;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInlineError(null);

    const tempoRounded = Math.round(Number(tempoStr));
    if (!isValidTempo(tempoRounded)) {
      const msg = 'Tempo must be a whole number between 20 and 300 BPM.';
      setInlineError(msg);
      showErrorToast(msg);
      return;
    }

    const numerator = Number.parseInt(numStr, 10);
    const denominator = Number.parseInt(denStr, 10);
    const meter: TimeSignature = { numerator, denominator };
    if (!isValidMeter(meter)) {
      const msg =
        'Time signature must use a numerator from 1 to 32 and a denominator of 1, 2, 4, 8, 16, or 32.';
      setInlineError(msg);
      showErrorToast(msg);
      return;
    }

    onApply({ tempo: tempoRounded, meter });
    onDismiss();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onDismiss();
      }}
    >
      <div
        data-testid="vybpad-tempo-meter-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-[var(--color-text-primary,#111827)]">
          Tempo &amp; meter — measure {displayMeasure}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary,#4B5563)]">
          Sets a change at the start of this measure. Later measures inherit until another change.
          Song metadata remains the defaults for new measures and export.
        </p>

        <form className="mt-4 space-y-4" noValidate onSubmit={handleSubmit}>
          <div>
            <label htmlFor="vybpad-tempo-meter-bpm" className="text-sm font-medium text-[var(--color-text-primary,#111827)]">
              Tempo (BPM)
            </label>
            <input
              id="vybpad-tempo-meter-bpm"
              type="number"
              min={20}
              max={300}
              step={1}
              value={tempoStr}
              onChange={(e) => setTempoStr(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 py-2 font-mono text-sm text-[var(--color-text-primary,#111827)] outline-none focus:border-[var(--color-primary,#4F46E5)] focus:ring-1 focus:ring-[var(--color-primary,#4F46E5)]"
              aria-invalid={inlineError ? true : undefined}
              aria-describedby={inlineError ? 'vybpad-tempo-meter-error' : undefined}
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="vybpad-tempo-meter-num" className="text-sm font-medium text-[var(--color-text-primary,#111827)]">
                Beats per bar
              </label>
              <input
                id="vybpad-tempo-meter-num"
                type="number"
                min={1}
                max={32}
                step={1}
                value={numStr}
                onChange={(e) => setNumStr(e.target.value)}
                className="mt-1 w-20 rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-primary,#4F46E5)] focus:ring-1 focus:ring-[var(--color-primary,#4F46E5)]"
              />
            </div>
            <span className="pb-2 text-sm text-[var(--color-text-muted,#9CA3AF)]" aria-hidden="true">
              /
            </span>
            <div>
              <label htmlFor="vybpad-tempo-meter-den" className="text-sm font-medium text-[var(--color-text-primary,#111827)]">
                Beat unit
              </label>
              <select
                id="vybpad-tempo-meter-den"
                value={denStr}
                onChange={(e) => setDenStr(e.target.value)}
                className="mt-1 block rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary,#4F46E5)] focus:ring-1 focus:ring-[var(--color-primary,#4F46E5)]"
              >
                {DENOM_OPTIONS.map((d) => (
                  <option key={d} value={String(d)}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {inlineError ? (
            <p
              id="vybpad-tempo-meter-error"
              role="alert"
              className="text-sm text-[var(--color-destructive,#DC2626)]"
            >
              {inlineError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
              onClick={onDismiss}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-4 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            >
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
