import type { MeasureChanges, SongData, TimeSignature } from '@vybpad/shared';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

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

function getTabbableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    ),
  );
}

/**
 * TASK-5.6: measure-level tempo + meter (INTERFACES `MeasureChanges`); UX §5.6 modal (trap, Escape, focus restore).
 */
export function TempoMeterAtMeasureDialog({
  open,
  measureIndex,
  song,
  onDismiss,
  onApply,
}: TempoMeterAtMeasureDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
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

  useLayoutEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement as HTMLElement | null;

    requestAnimationFrame(() => {
      const bpm = document.getElementById('vybpad-tempo-meter-bpm');
      if (bpm instanceof HTMLElement) {
        bpm.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onDismissRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = getTabbableIn(panelRef.current);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (previousActive && typeof previousActive.focus === 'function' && document.body.contains(previousActive)) {
        previousActive.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const displayMeasure = measureIndex + 1;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInlineError(null);

    const trimmed = tempoStr.trim();
    const tempoMsg = 'Tempo must be a whole number between 20 and 300 BPM.';
    // Reject decimals, scientific notation, and non-digits — do not round (INTERFACES: integer BPM 20–300).
    if (trimmed === '' || !/^\d+$/.test(trimmed)) {
      setInlineError(tempoMsg);
      showErrorToast(tempoMsg);
      return;
    }
    const tempoParsed = Number.parseInt(trimmed, 10);
    if (!isValidTempo(tempoParsed)) {
      setInlineError(tempoMsg);
      showErrorToast(tempoMsg);
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

    onApply({ tempo: tempoParsed, meter });
    onDismiss();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.5)] p-4"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onDismiss();
      }}
    >
      <div
        ref={panelRef}
        data-testid="vybpad-tempo-meter-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full min-w-[min(400px,100%)] max-w-[min(560px,calc(100vw-32px))] rounded-xl border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pr-10">
          <h2 id={titleId} className="text-lg font-semibold text-[var(--color-text-primary,#111827)]">
            Tempo &amp; meter — measure {displayMeasure}
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-secondary,#4B5563)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            onClick={onDismiss}
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>
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
