import { useId, useLayoutEffect, useMemo, useRef } from 'react';

import type { ChordEvent, NoteName, ScaleDegree, ScaleType } from '@vybpad/shared';

import { theoryEngine } from '../../engine/theory';
import { pat010DiatonicHex } from '../../engine/renderer/colorMaps';

type ProgressionPreset = {
  id: string;
  sequence: readonly ScaleDegree[];
};

const PROGRESSION_PRESETS: readonly ProgressionPreset[] = [
  { id: 'a', sequence: [1, 4, 5, 1] },
  { id: 'b', sequence: [2, 5, 1, 6] },
] as const;

function getTabbableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]',
    ),
  ).filter((el) => el.getAttribute('tabindex') !== '-1');
}

function buildDiatonicPayload(scale: ScaleType, degree: ScaleDegree): Omit<ChordEvent, 'id' | 'beat' | 'duration'> {
  return {
    scaleDegree: degree,
    quality: theoryEngine.getDiatonicQuality(degree, scale),
    seventh: theoryEngine.getDiatonicSeventh(degree, scale),
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
  };
}

export interface ProgressionsOverlayProps {
  open: boolean;
  currentKey: NoteName;
  currentScale: ScaleType;
  onChordSelect: (chord: Omit<ChordEvent, 'id' | 'beat' | 'duration'>) => void;
  onClose: () => void;
  focusReturnTarget?: HTMLElement | null;
}

export function ProgressionsOverlay({
  open,
  currentKey,
  currentScale,
  onChordSelect,
  onClose,
  focusReturnTarget,
}: ProgressionsOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const fallbackFocusReturnRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const presets = useMemo(() => {
    return PROGRESSION_PRESETS.map((preset) => {
      const steps = preset.sequence.map((degree) => {
        const preview: ChordEvent = {
          id: 'progression-preview',
          ...buildDiatonicPayload(currentScale, degree),
          beat: 0,
          duration: 48,
        };
        const roman = theoryEngine.toRomanNumeral(preview, currentScale);
        const chordName = theoryEngine.toChordName(preview, currentKey, currentScale);
        return {
          degree,
          fill: pat010DiatonicHex(degree),
          roman,
          chordName,
        };
      });
      return { ...preset, steps };
    });
  }, [currentKey, currentScale]);

  const applyProgression = (degrees: readonly ScaleDegree[]): void => {
    for (const degree of degrees) {
      onChordSelect(buildDiatonicPayload(currentScale, degree));
    }
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const restoreTarget =
      focusReturnTarget ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    previousActiveRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (restoreTarget) {
      fallbackFocusReturnRef.current = restoreTarget;
    }

    const moveFocusInside = () => {
      const focusables = getTabbableElements(panel);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panel.focus();
      }
    };

    moveFocusInside();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }

      const focusables = getTabbableElements(panel);
      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const activeIndex = focusables.findIndex((element) => element === active);
      let nextFocus: HTMLElement | undefined;

      if (activeIndex === -1) {
        nextFocus = event.shiftKey ? last : first;
      } else if (event.shiftKey && activeIndex === 0) {
        nextFocus = last;
      } else if (!event.shiftKey && activeIndex === focusables.length - 1) {
        nextFocus = first;
      } else if (event.shiftKey) {
        nextFocus = focusables[activeIndex - 1];
      } else {
        nextFocus = focusables[activeIndex + 1];
      }

      if (nextFocus) {
        nextFocus.focus();
      }

      event.stopPropagation();
      event.preventDefault();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      const next =
        fallbackFocusReturnRef.current ??
        (previousActiveRef.current && document.body.contains(previousActiveRef.current)
          ? previousActiveRef.current
          : null);
      if (next && typeof next.focus === 'function') {
        next.focus();
      }
    };
  }, [focusReturnTarget, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      id="vybpad-panel-progressions"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-start justify-end bg-[rgba(17,24,39,0.5)] p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-[min(560px,calc(100vw-32px))] min-w-[320px] max-h-[min(560px,80vh)] overflow-y-auto rounded-xl border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] p-5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-[var(--color-text-primary,#111827)]">
            Progressions
          </h2>
          <button
            type="button"
            aria-label="Close progressions panel"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-secondary,#4B5563)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            onClick={onClose}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>
        <div
          className="flex flex-col gap-2.5"
          role="list"
          aria-label="Prebuilt chord progressions"
        >
          {presets.map((preset, index) => (
            <button
              key={preset.id}
              type="button"
              data-testid={`chord-palette-progression-preset-${preset.id}`}
              role="listitem"
              className="w-full rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] p-2.5 text-left transition hover:border-[var(--color-primary,#4F46E5)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
              aria-label={`Apply progression ${preset.steps.map((step) => step.roman).join('\u2013')}`}
              onClick={() => applyProgression(preset.sequence)}
            >
              <span className="mb-1.5 flex min-h-8 items-center gap-1.5">
                {preset.steps.map((step) => (
                  <span
                    key={`${preset.id}-${step.degree}-${step.roman}`}
                    className="flex min-w-[2.25rem] flex-1 items-center justify-center rounded-md border border-[var(--color-border-strong,#D1D5DB)] px-1.5 py-1 text-[12px] font-semibold leading-none text-[var(--color-text-primary,#111827)]"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${step.fill}33 0, ${step.fill}33 4px), linear-gradient(var(--color-surface,#FFFFFF), var(--color-surface,#FFFFFF))`,
                    }}
                  >
                    {step.roman}
                  </span>
                ))}
              </span>
              <span className="text-xs text-[var(--color-text-muted,#9CA3AF)]">
                {`Preset ${String.fromCharCode('A'.charCodeAt(0) + index)} (${preset.steps
                  .map((step) => step.chordName)
                  .join(' \u2013 ')})`}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
