import type { ChordEvent, ProjectResponse, SongData, Track, TrackRole } from '@vybpad/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { LoopBar } from '../components/controls/LoopBar';
import { TempoMeterAtMeasureDialog } from '../components/controls/TempoMeterAtMeasureDialog';
import { TransportControls } from '../components/controls/TransportControls';
import { MixerPanel } from '../components/panels/MixerPanel';
import { MeasureBar } from '../components/MeasureBar';
import { EditorCanvas } from '../components/editor/EditorCanvas';
import {
  clearSecondaryChordEdit,
  cycleSecondaryChordEdit,
  resolveTargetMeasureIndex,
} from '../components/editor/editorKeyboardLogic';
import { ChordPalette, SecondaryChordInspector } from '../components/panels/ChordPalette';
import { getKeyAtMeasure, getScaleAtMeasure } from '../engine/renderer/tickUtils';
import { theoryEngine } from '../engine/theory';
import { applyChordScaleDegreeFromEditor, type EditorKeyboardContext } from '../hooks/useKeyboard';
import { EntryModeToggle } from '../components/editor/EntryModeToggle';
import { formatTransportBeat, getPlaybackEngine, getPlaybackInitErrorMessage } from '../engine/audio';
import { useAuthStore } from '../store/authStore';
import { syncPlaybackEngineWithSong, usePlaybackStore } from '../store/playbackStore';
import { buildDefaultSong, useSongStore } from '../store/songStore';
import { useToastStore } from '../store/toastStore';
import { useUIStore } from '../store/uiStore';
import { projectsApi } from '../utils/apiClient';
import { getApiErrorMessage, isApiTransportFailure } from '../utils/errorMessages';
import {
  clearAllEditorPostBootstrap,
  clearEditorPostBootstrap,
  markEditorPostBootstrapFromNavigate,
  shouldSkipDuplicateGetAfterPostBootstrap,
} from './editorProjectHydration';

/** TASK-3.4: idle delay after the last edit before auto PUT (coalesces rapid edits). */
const AUTOSAVE_DEBOUNCE_MS = 1500;

/** Compare the song snapshot we PUT with current store state to detect edits during an in-flight save. */
function songMatchesSentBaseline(sent: SongData, now: SongData): boolean {
  return JSON.stringify(sent) === JSON.stringify(now);
}

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
  const setMeasureChanges = useSongStore((s) => s.setMeasureChanges);
  const updateMetadata = useSongStore((s) => s.updateMetadata);
  const updateBandConfig = useSongStore((s) => s.updateBandConfig);

  const playbackTick = usePlaybackStore((s) => s.currentTick);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const initStatus = usePlaybackStore((s) => s.initStatus);
  const initErrorCode = usePlaybackStore((s) => s.initErrorCode);
  const initializeAudio = usePlaybackStore((s) => s.initializeAudio);
  const playbackPlay = usePlaybackStore((s) => s.play);
  const playbackPause = usePlaybackStore((s) => s.pause);
  const playbackStop = usePlaybackStore((s) => s.stop);
  const playbackRewind = usePlaybackStore((s) => s.rewind);

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
  /**
   * POST /projects → /editor/:id bootstrap hydrates from `location.state`. The load effect can re-run
   * when dependency identities change while state still holds the boot project; repeating `loadSong`
   * resets `isDirty` and drops debounced autosave (TASK-3.5 E2E).
   * Module-level {@link markEditorPostBootstrapFromNavigate} survives Strict Mode remounts (TASK-4.2).
   */
  const editorBootstrapHydratedIdRef = useRef<string | null>(null);

  const viewport = useUIStore((s) => s.viewport);
  const selection = useUIStore((s) => s.selection);
  const setSelection = useUIStore((s) => s.setSelection);
  const setViewport = useUIStore((s) => s.setViewport);
  const entryMode = useUIStore((s) => s.entryMode);
  const toggleEntryMode = useUIStore((s) => s.toggleEntryMode);
  const activeVoice = useUIStore((s) => s.activeVoice);
  const setActiveVoice = useUIStore((s) => s.setActiveVoice);
  const showGuides = useUIStore((s) => s.showGuides);
  const colorScheme = useUIStore((s) => s.colorScheme);
  const activePanels = useUIStore((s) => s.activePanels);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const mixerOpen = activePanels.has('mixer');

  const [selectedMeasures, setSelectedMeasures] = useState<[number, number] | null>(null);
  const [tempoMeterDialogOpen, setTempoMeterDialogOpen] = useState(false);
  /** Shared with `EditorCanvas` keyboard + chord palette (TASK-5.1). */
  const keyboardTargetMeasureRef = useRef<number | null>(null);
  const textDurationArmedRef = useRef(false);
  const [currentDurationTicks, setCurrentDurationTicks] = useState(48);
  const [chordPaletteExpanded, setChordPaletteExpanded] = useState(true);

  const getSongAfterMutation = useCallback(() => useSongStore.getState().song, []);
  const getSelectionAfterMutation = useCallback(() => useUIStore.getState().selection, []);

  const paletteMeasureIndex = useMemo(
    () => resolveTargetMeasureIndex(selection, viewport, song),
    [selection, viewport, song],
  );
  const paletteKey = getKeyAtMeasure(song, paletteMeasureIndex);
  const paletteScale = getScaleAtMeasure(song, paletteMeasureIndex);

  const handleChordPaletteSelect = useCallback(
    (chord: Omit<ChordEvent, 'id' | 'beat' | 'duration'>) => {
      const ctx: EditorKeyboardContext = {
        song,
        viewport,
        selection,
        activeVoice,
        setActiveVoice,
        entryMode,
        currentDurationTicks,
        setCurrentDurationTicks,
        keyboardTargetMeasureRef,
        textDurationArmedRef,
        getSongAfterMutation,
        getSelectionAfterMutation,
        onToggleEntryMode: toggleEntryMode,
        onChordEdit: editChord,
        onNoteEdit: editNote,
        onSelectionChange: setSelection,
      };
      applyChordScaleDegreeFromEditor(ctx, chord.scaleDegree);
    },
    [
      song,
      viewport,
      selection,
      activeVoice,
      setActiveVoice,
      entryMode,
      currentDurationTicks,
      setCurrentDurationTicks,
      getSongAfterMutation,
      getSelectionAfterMutation,
      toggleEntryMode,
      editChord,
      editNote,
      setSelection,
    ],
  );

  const handleTrackChange = useCallback(
    (role: TrackRole, changes: Partial<Track>) => {
      // Runtime merge is by role (songStore); partial patches are valid — assert for `Partial<BandConfig>` typing.
      updateBandConfig({ tracks: [{ role, ...changes } as Track] });
      const engine = getPlaybackEngine();
      if (!engine.isReady()) return;
      const t = useSongStore.getState().song.bandConfig.tracks.find((tr) => tr.role === role);
      if (!t) return;
      engine.setTrackVolume(role, t.volume);
      engine.setTrackMute(role, t.mute);
    },
    [updateBandConfig],
  );

  useEffect(() => {
    syncPlaybackEngineWithSong();
  }, [song]);

  // Load song for `/editor/:projectId` (GET) or hydrate from navigation state after POST /projects (no duplicate GET).
  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      editorBootstrapHydratedIdRef.current = null;
      clearAllEditorPostBootstrap();
      loadSong(buildDefaultSong());
      setProjectName(null);
      setLoadStatus('ready');
      return;
    }

    // POST-bootstrap ref is only meaningful for the current route param; clear when switching projects.
    if (editorBootstrapHydratedIdRef.current != null && editorBootstrapHydratedIdRef.current !== projectId) {
      editorBootstrapHydratedIdRef.current = null;
    }

    const navState = location.state as EditorLocationState | null;
    const boot = navState?.project;
    if (boot && boot.id === projectId) {
      if (editorBootstrapHydratedIdRef.current === projectId) {
        return;
      }
      editorBootstrapHydratedIdRef.current = projectId;
      markEditorPostBootstrapFromNavigate(projectId);
      loadSong(boot.songData);
      setProjectName(boot.name);
      setLoadStatus('ready');
      return;
    }

    // Strict Mode remount clears the ref; `location.state` may also be gone. If we already hydrated from
    // POST /projects for this id, do not GET — it can race chord entry and `loadSong` would clear
    // `isDirty` / wipe edits before autosave (TASK-4.2 E2E).
    if (shouldSkipDuplicateGetAfterPostBootstrap(projectId)) {
      editorBootstrapHydratedIdRef.current = projectId;
      setLoadStatus('ready');
      return;
    }

    // Router may replace `location` and drop `state` while `projectId` is unchanged (see deps comment
    // below). Legacy ref path kept for in-flight effect re-runs without unmount.
    if (editorBootstrapHydratedIdRef.current === projectId) {
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
        clearEditorPostBootstrap(projectId);
        navigate('/projects', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Read `location.state` when `projectId` changes (POST create bootstrap). Do **not** list
    // `location.state` in deps — Router can replace `location` without a project change and drop
    // `state`, which would re-run this effect, GET the project, and `loadSong` would clear
    // `isDirty` (TASK-3.5 E2E autosave).
  }, [projectId, loadSong, navigate, showErrorToast]);

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
    if (projectId) clearEditorPostBootstrap(projectId);
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
        const latest = useSongStore.getState().song;
        if (songMatchesSentBaseline(current, latest)) {
          loadSong(updated.songData);
          setProjectName(updated.name);
          if (source === 'manual') {
            showSuccessToast('Saved.');
          }
        } else {
          // Newer edits landed while PUT was in flight — do not clobber with server echo; save again.
          queuedSaveRef.current = true;
        }
      } catch (err) {
        showErrorToast(getApiErrorMessage(err));
        // Re-queue autosave only for transport failures (PAT-001). Typed API errors must not spin retries.
        if (
          source === 'auto' &&
          isApiTransportFailure(err) &&
          useSongStore.getState().isDirty &&
          projectId &&
          loadStatus === 'ready'
        ) {
          if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
          }
          autosaveTimerRef.current = setTimeout(() => {
            autosaveTimerRef.current = null;
            void runProjectSaveRef.current('auto');
          }, AUTOSAVE_DEBOUNCE_MS);
        }
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
      // Use ref (not `runProjectSave` closure) so this effect does not re-run when only the
      // callback identity changes — otherwise the cleanup can clear the timer and autosave never fires (TASK-3.5 E2E).
      // Return promise so Vitest fake timers (`runAllTimersAsync`) await the PUT + store update.
      return runProjectSaveRef.current('auto');
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
    // `runProjectSave` is invoked via `runProjectSaveRef` so this effect does not depend on callback identity.
  }, [song, isDirty, projectId, loadStatus]);

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

  const currentBeatDisplay = formatTransportBeat(song, playbackTick ?? 0);

  const selectedChordId = selection?.type === 'chord' ? selection.eventIds?.[0] : undefined;
  const selectedChord =
    selectedChordId != null && selection?.type === 'chord'
      ? song.measures[selection.measureIndex]?.chords.find((c) => c.id === selectedChordId) ?? null
      : null;

  const chordTheoryScale =
    selectedChord != null && selection?.type === 'chord'
      ? getScaleAtMeasure(song, selection.measureIndex)
      : paletteScale;

  const selectedChordRoman =
    selectedChord != null ? theoryEngine.toRomanNumeral(selectedChord, chordTheoryScale) : '';

  async function handleTransportPlay() {
    if (usePlaybackStore.getState().initStatus === 'ready') {
      playbackPlay();
      return;
    }
    await initializeAudio();
    const st = usePlaybackStore.getState();
    if (st.initStatus === 'ready') {
      st.play();
    } else if (st.initErrorCode) {
      showErrorToast(getPlaybackInitErrorMessage(st.initErrorCode));
    }
  }

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
            onClick={() => {
              if (projectId) clearEditorPostBootstrap(projectId);
              navigate('/projects');
            }}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Projects
          </button>
          <EntryModeToggle mode={entryMode} onToggle={toggleEntryMode} />
          <span
            className="inline-flex h-8 shrink-0 items-center rounded-md border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface-muted,#F9FAFB)] px-2 text-[12px] font-medium text-[var(--color-text-secondary,#4B5563)]"
            title="Active melody voice (Ctrl+1–4)"
            aria-live="polite"
          >
            Voice {activeVoice + 1}
          </span>
          <button
            type="button"
            onClick={() => setChordPaletteExpanded((o) => !o)}
            aria-expanded={chordPaletteExpanded}
            aria-controls="vybpad-panel-chords"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Chords
          </button>
          <button
            type="button"
            onClick={() => togglePanel('mixer')}
            aria-expanded={mixerOpen}
            aria-controls={mixerOpen ? 'vybpad-panel-mixer' : undefined}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Mixer
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Log out
          </button>
        </div>
      </header>
      <TransportControls
        isPlaying={isPlaying}
        tempo={song.metadata.tempo}
        currentBeat={currentBeatDisplay}
        initStatus={initStatus}
        initErrorCode={initErrorCode}
        onPlay={() => void handleTransportPlay()}
        onPause={playbackPause}
        onStop={playbackStop}
        onRewind={playbackRewind}
        onTempoChange={(bpm) => {
          const n = Math.round(bpm);
          if (!Number.isFinite(n) || n < 20 || n > 300) return;
          updateMetadata({ tempo: n });
        }}
      />
      <LoopBar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-row">
        <aside
          id="vybpad-panel-chords"
          className={
            chordPaletteExpanded
              ? 'flex w-[288px] min-w-[240px] max-w-[400px] shrink-0 flex-col border-r border-[var(--color-border,#E5E7EB)] bg-[var(--color-app-bg,#F3F4F6)]'
              : 'flex w-12 shrink-0 flex-col items-center border-r border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] py-3'
          }
          role="complementary"
          aria-label="Chord palette panel"
        >
          {chordPaletteExpanded ? (
            <>
              <ChordPalette
                currentKey={paletteKey}
                currentScale={paletteScale}
                mode="diatonic"
                onChordSelect={handleChordPaletteSelect}
              />
              <SecondaryChordInspector
                chord={selectedChord}
                romanLabel={selectedChordRoman}
                onCycle={() => {
                  if (selection?.type !== 'chord' || !selection.eventIds?.[0]) return;
                  const id = selection.eventIds[0];
                  const ch = song.measures[selection.measureIndex]?.chords.find((c) => c.id === id);
                  if (!ch) return;
                  const k = getKeyAtMeasure(song, selection.measureIndex);
                  const sc = getScaleAtMeasure(song, selection.measureIndex);
                  const changes = cycleSecondaryChordEdit(ch, k, sc);
                  if (Object.keys(changes).length === 0) return;
                  editChord(selection.measureIndex, { type: 'update', chordId: id, changes });
                }}
                onClear={() => {
                  if (selection?.type !== 'chord' || !selection.eventIds?.[0]) return;
                  const id = selection.eventIds[0];
                  const ch = song.measures[selection.measureIndex]?.chords.find((c) => c.id === id);
                  if (!ch) return;
                  const k = getKeyAtMeasure(song, selection.measureIndex);
                  const sc = getScaleAtMeasure(song, selection.measureIndex);
                  const changes = clearSecondaryChordEdit(ch, k, sc);
                  if (Object.keys(changes).length === 0) return;
                  editChord(selection.measureIndex, { type: 'update', chordId: id, changes });
                }}
              />
            </>
          ) : (
            <button
              type="button"
              title="Expand chord palette"
              aria-label="Expand chord palette"
              aria-expanded={false}
              aria-controls="vybpad-panel-chords"
              onClick={() => setChordPaletteExpanded(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] text-lg font-semibold leading-none text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            >
              ›
            </button>
          )}
        </aside>
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
                playbackTick={playbackTick}
                activeVoice={activeVoice}
                entryMode={entryMode}
                showGuides={showGuides}
                colorScheme={colorScheme}
                onChordEdit={editChord}
                onNoteEdit={editNote}
                onSelectionChange={setSelection}
                onViewportChange={setViewport}
                getSongAfterMutation={getSongAfterMutation}
                getSelectionAfterMutation={getSelectionAfterMutation}
                onToggleEntryMode={toggleEntryMode}
                keyboardPlumbing={{
                  keyboardTargetMeasureRef,
                  textDurationArmedRef,
                  currentDurationTicks,
                  setCurrentDurationTicks,
                }}
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
            onEditTempoMeter={() => setTempoMeterDialogOpen(true)}
          />
        </div>
        {mixerOpen ? (
          <aside
            id="vybpad-panel-mixer"
            className="flex w-[288px] shrink-0 flex-col border-l border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)]"
            role="complementary"
            aria-label="Mixer"
          >
            <MixerPanel bandConfig={song.bandConfig} onTrackChange={handleTrackChange} />
          </aside>
        ) : null}
      </div>
      <TempoMeterAtMeasureDialog
        open={tempoMeterDialogOpen}
        measureIndex={selectedMeasures?.[0] ?? 0}
        song={song}
        onDismiss={() => setTempoMeterDialogOpen(false)}
        onApply={(changes) => {
          const idx = selectedMeasures?.[0] ?? 0;
          setMeasureChanges(idx, changes);
        }}
      />
    </div>
  );
}
