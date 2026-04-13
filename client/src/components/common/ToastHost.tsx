import { useToastStore } from '../../store/toastStore';

/** Fixed region for API/error toasts — UX §5.7: assertive live region for errors. */
export function ToastHost() {
  const message = useToastStore((s) => s.message);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[9999] flex max-w-[min(480px,calc(100vw-32px))] -translate-x-1/2 justify-center px-4"
    >
      <div className="pointer-events-auto flex items-start gap-3 rounded-lg border border-[var(--color-destructive,#DC2626)] bg-[var(--color-surface,#FFFFFF)] px-4 py-3 text-sm text-[var(--color-destructive,#DC2626)] shadow-lg">
        <span className="min-w-0 flex-1">{message}</span>
        <button
          type="button"
          onClick={() => dismiss()}
          className="shrink-0 rounded px-1 text-base leading-none text-[var(--color-text-secondary,#4B5563)] outline-none hover:text-[var(--color-text-primary,#111827)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)]"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}
