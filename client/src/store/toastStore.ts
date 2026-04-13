import { create } from 'zustand';

type ToastState = {
  message: string | null;
  /** PAT-001 / UX §5.7 — API errors via toast; messages come from getApiErrorMessage / ERROR_MESSAGES. */
  showError: (message: string) => void;
  dismiss: () => void;
};

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

/** Dedupe identical errors from StrictMode double-invoke or rapid retries (dev). */
let lastErrorDedupe: { msg: string; at: number } | null = null;
const DEDUPE_MS = 1500;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  showError: (message) => {
    const now = Date.now();
    if (
      lastErrorDedupe &&
      lastErrorDedupe.msg === message &&
      now - lastErrorDedupe.at < DEDUPE_MS
    ) {
      return;
    }
    lastErrorDedupe = { msg: message, at: now };

    if (dismissTimer) clearTimeout(dismissTimer);
    set({ message });
    dismissTimer = setTimeout(() => {
      set({ message: null });
      dismissTimer = null;
    }, 6000);
  },
  dismiss: () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    dismissTimer = null;
    set({ message: null });
  },
}));
