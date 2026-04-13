import { useEffect, useRef } from 'react';

import type { ProjectSummary } from '@vybpad/shared';

type DeleteProjectDialogProps = {
  project: ProjectSummary | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** UX §5.6 — irreversible delete: modal with primary destructive last (tests: /^delete permanently$/i). */
export function DeleteProjectDialog({ project, busy, onConfirm, onCancel }: DeleteProjectDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (project) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [project]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="delete-project-dialog-title"
      className="max-h-[min(560px,80vh)] w-[min(560px,calc(100vw-32px))] rounded-xl border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] p-6 shadow-lg backdrop:bg-[rgba(17,24,39,0.5)]"
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={() => {
        if (!busy) onCancel();
      }}
    >
      {project ? (
        <div className="flex flex-col gap-4">
          <h2 id="delete-project-dialog-title" className="text-lg font-semibold text-[var(--color-text-primary,#111827)]">
            Delete project?
          </h2>
          <p className="text-sm text-[var(--color-text-secondary,#4B5563)]">
            &quot;{project.name}&quot; will be permanently removed. This cannot be undone.
          </p>
          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--color-destructive,#DC2626)] px-4 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none transition hover:bg-[var(--color-destructive-hover,#B91C1C)] focus-visible:ring-2 focus-visible:ring-[var(--color-destructive,#DC2626)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
