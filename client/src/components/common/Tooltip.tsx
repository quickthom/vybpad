import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';

/** UX §8 — hover/tooltip family aligns with 120ms micro-interaction timing. */
const SHOW_DELAY_MS = 120;
const HIDE_DELAY_MS = 80;

export type TooltipProps = {
  /** Supplemental description; not a substitute for an accessible name on the trigger. */
  label: string;
  children: ReactElement;
};

/**
 * Option A (F10): lightweight tooltip — no Radix. `role="tooltip"` + `aria-describedby` on the
 * trigger while open; Escape dismisses when the tip was opened from keyboard focus.
 */
export function Tooltip({ label, children }: TooltipProps): ReactElement {
  const tipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const openedByKeyboardRef = useRef(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [open, setOpen] = useState(false);
  const [tipStyle, setTipStyle] = useState<CSSProperties | undefined>(undefined);

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleShow = useCallback(
    (fromKeyboard: boolean) => {
      clearHideTimer();
      clearShowTimer();
      showTimerRef.current = setTimeout(() => {
        showTimerRef.current = null;
        setOpen(true);
        openedByKeyboardRef.current = fromKeyboard;
      }, SHOW_DELAY_MS);
    },
    [clearHideTimer, clearShowTimer],
  );

  const scheduleHide = useCallback(() => {
    clearShowTimer();
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setOpen(false);
      openedByKeyboardRef.current = false;
    }, HIDE_DELAY_MS);
  }, [clearHideTimer, clearShowTimer]);

  const hideNow = useCallback(() => {
    clearShowTimer();
    clearHideTimer();
    setOpen(false);
    openedByKeyboardRef.current = false;
  }, [clearHideTimer, clearShowTimer]);

  const updatePosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = r.top - 8;
    const left = r.left + r.width / 2;
    setTipStyle({
      position: 'fixed',
      top,
      left,
      transform: 'translate(-50%, -100%)',
      zIndex: 50,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setTipStyle(undefined);
      return;
    }
    updatePosition();
  }, [open, label, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open || !openedByKeyboardRef.current) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        hideNow();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, hideNow]);

  const child = children;
  const prevDescribedBy = (child.props as { 'aria-describedby'?: string })['aria-describedby'];
  const describedBy =
    open && tipId
      ? [prevDescribedBy, tipId].filter(Boolean).join(' ') || tipId
      : prevDescribedBy;

  const merged = cloneElement(child, {
    'aria-describedby': describedBy,
  } as Partial<typeof child.props>);

  const tooltipNode =
    open && tipStyle ? (
      <span
        id={tipId}
        role="tooltip"
        style={tipStyle}
        className="pointer-events-none max-w-[min(20rem,calc(100vw-1rem))] rounded-md border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-2 py-1.5 text-left text-[12px] leading-snug text-[var(--color-text-primary,#111827)] shadow-lg transition-opacity duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
      >
        {label}
      </span>
    ) : null;

  return (
    <span
      ref={wrapRef}
      className="inline-flex max-w-full"
      onMouseEnter={() => scheduleShow(false)}
      onMouseLeave={() => scheduleHide()}
      onFocusCapture={() => {
        queueMicrotask(() => {
          const ae = document.activeElement as HTMLElement | null;
          if (!ae || !wrapRef.current?.contains(ae)) return;
          if (ae.matches(':focus-visible')) {
            scheduleShow(true);
          }
        });
      }}
      onBlurCapture={() => scheduleHide()}
    >
      {merged}
      {typeof document !== 'undefined' && tooltipNode != null
        ? createPortal(tooltipNode, document.body)
        : null}
    </span>
  );
}
