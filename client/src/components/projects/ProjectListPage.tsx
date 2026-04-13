import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ProjectSummary } from '@vybpad/shared';

import { useMinViewport1024 } from '../../hooks/useMinViewport1024';
import { useProjects } from '../../hooks/useProjects';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { getApiErrorMessage } from '../../utils/errorMessages';
import { projectsApi } from '../../utils/apiClient';
import { DeleteProjectDialog } from './DeleteProjectDialog';

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatIso(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

/**
 * Authenticated project hub: list (ProjectSummary), create, open (load song + /editor), delete with confirm modal.
 * UX §3 max-width 480px; §5.10 row height 56px; page title h1; §4 viewport ≥1024px.
 */
export function ProjectListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const showErrorToast = useToastStore((s) => s.showError);

  const wideEnough = useMinViewport1024();
  const { projects, status, refresh } = useProjects();
  const [newName, setNewName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (createBusy) return;
    setCreateBusy(true);
    try {
      const created = await projectsApi.create({ name: newName.trim() });
      setNewName('');
      navigate(`/editor/${created.id}`, {
        replace: true,
        state: { project: created },
      });
      // List refresh skipped here — POST response already has songData; next /projects visit refetches.
    } catch (err) {
      showErrorToast(getApiErrorMessage(err));
    } finally {
      setCreateBusy(false);
    }
  }

  function handleOpen(project: ProjectSummary) {
    navigate(`/editor/${project.id}`, { replace: true });
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await projectsApi.delete(pendingDelete.id);
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      showErrorToast(getApiErrorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  const loading = status === 'loading' && projects.length === 0;

  if (!wideEnough) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg,#F3F4F6)] px-6 py-12 font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,'Noto_Sans',sans-serif]">
        <p className="max-w-md text-center text-base text-[var(--color-text-secondary,#4B5563)]">
          vYbpad needs a display at least 1024px wide. Please use a larger window or device.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-app-bg,#F3F4F6)] px-4 py-12 font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,'Noto_Sans',sans-serif] text-[var(--color-text-primary,#111827)]">
      <div className="mx-auto w-full max-w-[480px]">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary,#111827)]">
              Projects
            </h1>
            {user ? (
              <p className="mt-1 text-sm text-[var(--color-text-secondary,#4B5563)]">{user.displayName}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Log out
          </button>
        </header>

        <form
          onSubmit={(e) => {
            void handleCreate(e);
          }}
          className="mb-8 flex flex-col gap-4 rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] p-4"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="new-project-name" className="text-sm font-medium text-[var(--color-text-primary,#111827)]">
              New project name
            </label>
            <input
              id="new-project-name"
              name="name"
              type="text"
              value={newName}
              onChange={(ev) => setNewName(ev.target.value)}
              autoComplete="off"
              maxLength={100}
              placeholder="e.g. My song"
              className="h-10 rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none transition hover:border-[var(--color-border-strong,#D1D5DB)] focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={createBusy}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-4 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none transition hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {createBusy ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>

        <section aria-label="Your projects">
          <h2 className="sr-only">Your projects</h2>
          {loading ? (
            <ul className="flex flex-col gap-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="h-3 animate-pulse rounded bg-[var(--color-surface-muted,#E5E7EB)]"
                  style={{ animationDuration: '1.5s' }}
                />
              ))}
            </ul>
          ) : projects.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary,#4B5563)]">No projects yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)]">
              <table className="w-full min-w-[320px] border-collapse text-left text-sm">
                <tbody>
                  {projects.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-[var(--color-border,#E5E7EB)] last:border-b-0"
                    >
                      <td className="min-h-[56px] px-2 py-2 align-middle">
                        <button
                          type="button"
                          aria-label={p.name}
                          onClick={() => void handleOpen(p)}
                          className="flex w-full min-w-0 flex-col rounded-md px-2 py-2 text-left transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] disabled:pointer-events-none disabled:opacity-50"
                        >
                          <span className="truncate font-medium text-[var(--color-text-primary,#111827)]">{p.name}</span>
                          <span className="mt-0.5 text-xs text-[var(--color-text-secondary,#4B5563)]">
                            Created {formatIso(p.createdAt)} · Updated {formatIso(p.updatedAt)}
                          </span>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 align-middle">
                        <button
                          type="button"
                          disabled={deleteBusy}
                          aria-label={`Delete project ${p.name}`}
                          onClick={() => setPendingDelete(p)}
                          className="inline-flex h-10 min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-destructive,#DC2626)] bg-[#FEF2F2] px-3 text-sm font-medium text-[var(--color-destructive,#DC2626)] outline-none transition hover:bg-[#FEE2E2] focus-visible:ring-2 focus-visible:ring-[var(--color-destructive,#DC2626)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <DeleteProjectDialog
        project={pendingDelete}
        busy={deleteBusy}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleteBusy) setPendingDelete(null);
        }}
      />
    </div>
  );
}
