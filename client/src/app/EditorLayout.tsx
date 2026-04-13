import type { ProjectResponse } from '@vybpad/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { MeasureBar } from '../components/MeasureBar';
import { EditorCanvas } from '../components/editor/EditorCanvas';
import { EntryModeToggle } from '../components/editor/EntryModeToggle';
import { useAuthStore } from '../store/authStore';
import { buildDefaultSong, useSongStore } from '../store/songStore';
import { useToastStore } from '../store/toastStore';
import { useUIStore } from '../store/uiStore';
import { projectsApi } from '../utils/apiClient';
import { getApiErrorMessage } from '../utils/errorMessages';

/** TASK-3.4: idle delay after the last edit before auto PUT (coalesces rapid edits). */
const AUTOSAVE_DEBOUNCE_MS = 1500;

/** Passed from `ProjectListPage` after POST create so the editor can hydrate without a duplicate GET. */
export type EditorLocationState = { project?: ProjectResponse };

/**
 * Full grid editor shell (extracted from the former App root) so routing can swap auth vs editor
 * without duplicating canvas wiring — TASK-3.2 can add sibling routes next to `/editor`.
 */
export function EditorLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId?: string }>();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const song = useSongStore((s) => s.song);
  const isDirty = useSongStore((s) => s.isDirty);
  const loadSong = useSongStore((s) => s.loadSong);
  const editChord = useSongStore((s) => s.editChord);
  const editNote = useSongStore((s) => s.editNote);
  const addMeasures = useSongStore((s) => s.addMeasures);
  const deleteMeasures = useSongStore((s) => s.deleteMeasures);

  const showErrorToast = useToastStore((s) => s.showError);
  const showSuccessToast = useToastStore((s) => s.showSuccess);

  const [projectName, setProjectName] = useState<string | null>(null);
  /** `ready` = editor can render; for `/editor/:id` we wait for GET (or bootstrap state). */
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready'>(() =>
    projectId ? 'loading' : 'ready',
  );
  const [saveBusy, setSaveBusy] = useState(false);
  /** Mirrors `saveBusy` for async guards without putting `saveBusy` in `useCallback` deps (would reset debounce). */
  const saveBusyRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When a save is already in flight, coalesce another attempt after it finishes (debounce may fire mid-PUT). */
  const queuedSaveRef = useRef(false);
  const runProjectSaveRef = useRef<(source: 'manual' | 'auto') => Promise<void>>(async () => {});
  const projectNameRef = useRef(projectName);
  projectNameRef.current = projectName;

  const viewport = useUIStore((s) => s.viewport);
  const selection = useUIStore((s) => s.selection);
  const setSelection = useUIStore((s) => s.setSelection);
  const setViewport = useUIStore((s) => s.setViewport);
  const entryMode = useUIStore((s) => s.entryMode);
  const toggleEntryMode = useUIStore((s) => s.toggleEntryMode);
  const activeVoice = useUIStore((s) => s.activeVoice);
  const showGuides = useUIStore((s) => s.showGuides);
  const colorScheme = useUIStore((s) => s.colorScheme);

  const [selectedMeasures, setSelectedMeasures] = useState<[number, number] | null>(null);

  const getSongAfterMutation = useCallback(() => useSongStore.getState().song, []);

  // Load song for `/editor/:projectId` (GET) or hydrate from navigation state after POST /projects (no duplicate GET).
  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      loadSong(buildDefaultSong());
      setProjectName(null);
      setLoadStatus('ready');
      return;
    }

    const navState = location.state as EditorLocationState | null;
    const boot = navState?.project;
    if (boot && boot.id === projectId) {
      loadSong(boot.songData);
      setProjectName(boot.name);
      setLoadStatus('ready');
      return;
    }

    void (async () => {
      setLoadStatus('loading');
      try {
        const full = await projectsApi.get(projectId);
        if (cancelled) return;
        loadSong(full.songData);
        setProjectName(full.name);
        setLoadStatus('ready');
      } catch (err) {
        // Always surface API errors (PAT-001). Do not skip toast when `cancelled` is true:
        // 401 flows call `onAuthFailure` before throw, which unmounts this tree before catch runs.
        showErrorToast(getApiErrorMessage(err));
        if (cancelled) return;
        navigate('/projects', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
    // `location.state` is intentionally read when `projectId` changes (POST create bootstrap).
  }, [projectId, loadSong, navigate, showErrorToast, location.state]);

  useEffect(() => {
    setSelectedMeasures((prev) => {
      if (!prev) return null;
      const n = song.measures.length;
      if (n === 0) return null;
      const [a, b] = prev;
      const ca = Math.max(0, Math.min(a, n - 1));
      const cb = Math.max(0, Math.min(b, n - 1));
      const lo = Math.min(ca, cb);
      const hi = Math.max(ca, cb);
      if (lo === prev[0] && hi === prev[1]) return prev;
      return [lo, hi] as [number, number];
    });
  }, [song.measures.length]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const runProjectSave = useCallback(
    async (source: 'manual' | 'auto') => {
      if (!projectId || loadStatus !== 'ready') return;
      if (!useSongStore.getState().isDirty) return;
      if (saveBusyRef.current) {
        queuedSaveRef.current = true;
        return;
      }
      saveBusyRef.current = true;
      setSaveBusy(true);
      try {
        const current = useSongStore.getState().song;
        const pn = projectNameRef.current;
        const updated = await projectsApi.update(projectId, {
          songData: current,
          ...(pn !== null ? { name: pn } : {}),
        });
        loadSong(updated.songData);
        setProjectName(updated.name);
        if (source === 'manual') {
          showSuccessToast('Saved.');
        }
      } catch (err) {
        showErrorToast(getApiErrorMessage(err));
      } finally {
        saveBusyRef.current = false;
        setSaveBusy(false);
        if (queuedSaveRef.current && useSongStore.getState().isDirty) {
          queuedSaveRef.current = false;
          void runProjectSaveRef.current('auto');
        }
      }
    },
    [loadSong, loadStatus, projectId, showErrorToast, showSuccessToast],
  );

  runProjectSaveRef.current = runProjectSave;

  // TASK-3.4: debounced PUT while a project is open and the document is dirty (coalesces rapid edits).
  useEffect(() => {
    if (!projectId || loadStatus !== 'ready' || !isDirty) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return;
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      // Return promise so Vitest fake timers (`runAllTimersAsync`) await the PUT + store update.
      return runProjectSave('auto');
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [song, isDirty, projectId, loadStatus, runProjectSave]);

  async function handleSave() {
    if (!projectId || saveBusy || loadStatus !== 'ready') return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    await runProjectSave('manual');
  }

  const headerTitle = song.metadata.title || 'vYbpad';
  const saveDisabled = !projectId || !isDirty || saveBusy || loadStatus !== 'ready';

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-app-bg,#F3F4F6)] text-[var(--color-text-primary,#111827)]">
      <header className="flex min-h-[48px] flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-4 py-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{headerTitle}</h1>
          {projectName ? (
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary,#4B5563)]">{projectName}</p>
          ) : null}
          <p className="mt-1 text-sm text-[var(--color-text-secondary,#4B5563)]">
            Grid editor — click to select, drag to move, drag trailing edge to resize (TASK-2.7)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user ? (
            <span className="text-sm text-[var(--color-text-secondary,#4B5563)]">{user.displayName}</span>
          ) : null}
          {projectId ? (
            <button
              type="button"
              disabled={saveDisabled}
              onClick={() => void handleSave()}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-4 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none transition hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {saveBusy ? 'Saving…' : 'Save'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Projects
          </button>
          <EntryModeToggle mode={entryMode} onToggle={toggleEntryMode} />
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Log out
          </button>
        </div>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main
          className="min-h-0 flex-1 overflow-x-auto p-4"
          aria-busy={projectId ? loadStatus === 'loading' : false}
        >
          {projectId && loadStatus === 'loading' ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--color-text-secondary,#4B5563)]">
              Loading project…
            </div>
          ) : (
            <EditorCanvas
              song={song}
              viewport={viewport}
              selection={selection}
              playbackTick={null}
              activeVoice={activeVoice}
              entryMode={entryMode}
              showGuides={showGuides}
              colorScheme={colorScheme}
              onChordEdit={editChord}
              onNoteEdit={editNote}
              onSelectionChange={setSelection}
              onViewportChange={setViewport}
              getSongAfterMutation={getSongAfterMutation}
              onToggleEntryMode={toggleEntryMode}
            />
          )}
        </main>
        <MeasureBar
          measureCount={song.measures.length}
          selectedMeasures={selectedMeasures}
          measuresPerLine={viewport.measureCount}
          onSelectMeasure={(index) => setSelectedMeasures([index, index])}
          onSelectRange={(start, end) => setSelectedMeasures([start, end])}
          onAddMeasures={(count) => addMeasures(song.measures.length, count)}
          onDeleteMeasures={(start, end) => {
            const len = song.measures.length;
            const removing = end - start + 1;
            if (len - removing < 1) return;
            deleteMeasures(start, end);
          }}
        />
      </div>
    </div>
  );
}
