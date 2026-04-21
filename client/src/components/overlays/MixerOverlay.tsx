import { useId, useLayoutEffect, useRef } from 'react';

import { MixerPanel, type MixerPanelProps } from '../panels/MixerPanel';

function getTabbableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]',
    ),
  ).filter((el) => el.getAttribute('tabindex') !== '-1');
}

export interface MixerOverlayProps {
  open: boolean;
  bandConfig: MixerPanelProps['bandConfig'];
  onTrackChange: MixerPanelProps['onTrackChange'];
  onClose: () => void;
  focusReturnTarget?: HTMLElement | null;
}

export function MixerOverlay({
  open,
  bandConfig,
  onTrackChange,
  onClose,
  focusReturnTarget,
}: MixerOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const fallbackFocusReturnRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

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
        if (event.shiftKey) {
          nextFocus = last;
        } else {
          nextFocus = first;
        }
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
      id="vybpad-panel-mixer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.5)] p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-[min(560px,calc(100vw-32px))] min-w-[400px] max-h-[min(560px,80vh)] overflow-y-auto rounded-xl border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="sr-only">
          Mixer
        </h2>
        <button
          type="button"
          aria-label="Close mixer panel"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary,#4B5563)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          onClick={onClose}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </button>
        <MixerPanel bandConfig={bandConfig} onTrackChange={onTrackChange} />
      </div>
    </div>
  );
}
