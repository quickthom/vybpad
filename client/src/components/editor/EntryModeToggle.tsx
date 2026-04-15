import type { ReactElement } from 'react';

export interface EntryModeToggleProps {
  mode: 'table' | 'text';
  onToggle: () => void;
}

/**
 * TASK-2.9 — subtle entry mode indicator (Table vs Hookpad-style text/duration-first).
 * Tab toggles via useKeyboard; this mirrors the same state for pointer users.
 */
export function EntryModeToggle(props: EntryModeToggleProps): ReactElement {
  const { mode, onToggle } = props;
  const isTable = mode === 'table';
  return (
    <button
      type="button"
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-md border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-xs text-[var(--color-text-secondary,#4B5563)] transition-colors hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
      onClick={onToggle}
      aria-label={`Entry mode ${isTable ? 'Table' : 'Text'}. Click or press Tab to toggle.`}
      title="Entry mode — Tab to toggle (Table: advance after entry; Text: duration then degree)"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted,#9CA3AF)]">Entry</span>
      <span className="rounded px-1.5 py-0.5 text-xs font-semibold bg-[var(--color-surface-muted,#F9FAFB)] text-[var(--color-text-primary,#111827)] ring-1 ring-[var(--color-primary,#4F46E5)]">
        {isTable ? 'Table' : 'Text'}
      </span>
    </button>
  );
}
