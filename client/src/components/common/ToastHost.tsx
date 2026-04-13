import { useToastStore } from '../../store/toastStore';

/**
 * API/error toasts — UX §5.7: bottom-right stack, width min(400px, 100vw − 32px), 16px inset,
 * 8px stack gap, error = destructive accent + assertive; success = success accent + status.
 */
export function ToastHost() {
  const message = useToastStore((s) => s.message);
  const variant = useToastStore((s) => s.variant);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!message) return null;

  const isError = variant === 'error';
  const accent = isError
    ? 'border-l-[var(--color-destructive,#DC2626)]'
    : 'border-l-[var(--color-success,#16A34A)]';

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-[min(400px,calc(100vw-32px))] flex-col gap-2">
      <div
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
        className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-[var(--color-border,#E5E7EB)] border-l-4 ${accent} bg-[var(--color-surface,#FFFFFF)] p-4 shadow-lg`}
      >
        <span className="min-w-0 flex-1 text-sm font-semibold leading-normal text-[var(--color-text-primary,#111827)]">
          {message}
        </span>
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
