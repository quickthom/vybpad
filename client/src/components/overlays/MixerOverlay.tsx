import { useId, useLayoutEffect, useRef } from 'react';

import type { BandConfig, Track, TrackRole } from '@vybpad/shared';

import { MixerPanel } from '../panels/MixerPanel';

export interface MixerOverlayProps {
  open: boolean;
  bandConfig: BandConfig;
  onTrackChange: (role: TrackRole, changes: Partial<Track>) => void;
  onClose: () => void;
}

/**
 * TASK-R2-W7.3 — mixer presented as modal overlay to match toolbar-first access pattern.
 * UX §5.6 + §9: modal backdrop, Escape close, focus restore via parent `onClose` callback.
 */
export function MixerOverlay({ open, bandConfig, onTrackChange, onClose }: MixerOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    if (!open) return;

    if (!panelRef.current) return;
    const getFocusables = () => {
      return Array.from(
        panelRef.current!.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    };

    const focusFirst = () => {
      const focusables = getFocusables();
      const first = focusables[0];
      if (first) {
        first.focus();
      } else {
        panelRef.current?.focus();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusables = getFocusables();
      if (focusables.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      if (!active) return;

      const first = focusables[0];
      if (!first) return;
      const last = focusables.at(-1);
      if (!last) return;

      const activeIndex = focusables.indexOf(active);

      if (event.shiftKey) {
        if (activeIndex <= 0) {
          event.preventDefault();
          event.stopImmediatePropagation();
          last.focus();
        }
      } else if (activeIndex === -1 || activeIndex === focusables.length - 1) {
        event.preventDefault();
        event.stopImmediatePropagation();
        first.focus();
      }
    };

    focusFirst();
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const close = () => {
    onClose();
  };

  return (
    <div
      id="vybpad-panel-mixer"
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex min-h-0 items-center justify-center bg-[rgba(17,24,39,0.5)] p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div
        ref={panelRef}
        className="flex w-[min(560px,calc(100vw-32px))] min-w-[min(400px,calc(100vw-32px))] max-h-[min(560px,80vh)] flex-col rounded-xl border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] p-0 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-xl font-semibold text-[var(--color-text-primary,#111827)]">
            Mixer
          </h2>
          <button
            type="button"
            aria-label="Close Mixer"
            tabIndex={-1}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--color-text-secondary,#4B5563)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            onClick={close}
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>
        <MixerPanel bandConfig={bandConfig} onTrackChange={onTrackChange} />
      </div>
    </div>
  );
}
