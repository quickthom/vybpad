import { create } from 'zustand';

export type ToastVariant = 'error' | 'success';

type ToastState = {
  message: string | null;
  variant: ToastVariant;
  /** PAT-001 / UX §5.7 — API errors via toast; messages come from getApiErrorMessage / ERROR_MESSAGES. */
  showError: (message: string) => void;
  /** UX §5.7 — success accent; short-lived (4s). */
  showSuccess: (message: string) => void;
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
  const ms = variant === 'success' ? 4000 : 6000;
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
