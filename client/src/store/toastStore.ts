import { create } from 'zustand';

export type ToastVariant = 'error' | 'success' | 'info';

type ToastState = {
  message: string | null;
  variant: ToastVariant;
  /** PAT-001 / UX §5.7 — API errors via toast; messages come from getApiErrorMessage / ERROR_MESSAGES. */
  showError: (message: string) => void;
  /** UX §5.7 — success accent; short-lived (4s). */
  showSuccess: (message: string) => void;
  /** UX §5.7 — info accent; short-lived (4s); transient ops (e.g. MIDI drag-start), not completion. */
  showInfo: (message: string) => void;
  dismiss: () => void;
};

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

/** Dedupe identical toasts from StrictMode double-invoke or rapid retries (dev). */
let lastDedupe: { msg: string; at: number } | null = null;
const DEDUPE_MS = 1500;

function scheduleDismiss(
  set: (partial: Partial<ToastState>) => void,
  variant: ToastVariant,
): void {
  const ms = variant === 'error' ? 6000 : 4000;
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => {
    set({ message: null, variant: 'error' });
    dismissTimer = null;
  }, ms);
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  variant: 'error',
  showError: (message) => {
    const now = Date.now();
    if (lastDedupe && lastDedupe.msg === message && now - lastDedupe.at < DEDUPE_MS) {
      return;
    }
    lastDedupe = { msg: message, at: now };

    set({ message, variant: 'error' });
    scheduleDismiss(set, 'error');
  },
  showSuccess: (message) => {
    const now = Date.now();
    if (lastDedupe && lastDedupe.msg === message && now - lastDedupe.at < DEDUPE_MS) {
      return;
    }
    lastDedupe = { msg: message, at: now };

    set({ message, variant: 'success' });
    scheduleDismiss(set, 'success');
  },
  showInfo: (message) => {
    const now = Date.now();
    if (lastDedupe && lastDedupe.msg === message && now - lastDedupe.at < DEDUPE_MS) {
      return;
    }
    lastDedupe = { msg: message, at: now };

    set({ message, variant: 'info' });
    scheduleDismiss(set, 'info');
  },
  dismiss: () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    dismissTimer = null;
    set({ message: null, variant: 'error' });
  },
}));

/** Clears success/error dedupe window — use in tests that fire identical toasts in sequence. */
export function resetToastDedupeForTests(): void {
  lastDedupe = null;
}
