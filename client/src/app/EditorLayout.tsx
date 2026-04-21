import type { ChordEvent, ProjectResponse, ScaleDegree, SongData, Track, TrackRole } from '@vybpad/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { EditorPropertiesPanel } from '../components/panels/EditorPropertiesPanel';
import { EditorSettingsPanel } from '../components/panels/EditorSettingsPanel';
import { MixerOverlay } from '../components/overlays/MixerOverlay';
import { ProgressionsOverlay } from '../components/overlays/ProgressionsOverlay';
import { KeyScaleChangeDialog } from '../components/common/KeyScaleChangeDialog';
import { Tooltip } from '../components/common/Tooltip';
import { MidiExportControls } from '../components/controls/MidiExportControls';
import { TempoMeterAtMeasureDialog } from '../components/controls/TempoMeterAtMeasureDialog';
import { MidiDragExportControl } from '../components/controls/MidiDragExportControl';
import { LoopBar } from '../components/controls/LoopBar';
import { TransportControls } from '../components/controls/TransportControls';
import { PianoKeyboardPanel } from '../components/panels/PianoKeyboardPanel';
import { MeasureBar } from '../components/MeasureBar';
import { EditorCanvas } from '../components/editor/EditorCanvas';
import {
  clearSecondaryChordEdit,
  cycleSecondaryChordEdit,
  isEditableKeyboardTarget,
  navigateSelection,
  resolveTargetMeasureIndex,
} from '../components/editor/editorKeyboardLogic';
import { ChordPalette } from '../components/panels/ChordPalette';
import { MelodyEntryPanel } from '../components/panels/MelodyEntryPanel';
import { PlacementDurationControls } from '../components/panels/PlacementDurationControls';
import {
  getKeyAtMeasure,
  getMeasureStartTicks,
  getMeterAtMeasure,
  getScaleAtMeasure,
  measureIndexFromAbsoluteTick,
} from '../engine/renderer/tickUtils';
import { createShortcutManager } from '../engine/keyboard/shortcutManager';
import type { ShortcutCommandId, ShortcutContext } from '../engine/keyboard/shortcutTypes';
import { TASK73_EDITOR_SHORTCUT_CHORDS } from '../engine/keyboard/task73ShortcutChords';
import { computeMeasuresPerLine } from '../engine/renderer/measurePacking';
import {
  TASK75_NAVIGATION_SHORTCUT_CHORDS,
  TASK75_TRANSPORT_SHORTCUT_CHORDS,
} from '../engine/keyboard/task75NavigationShortcutChords';
import { theoryEngine } from '../engine/theory';
import {
  applyChordPalettePayloadFromEditor,
  applyMelodyAddFromEditor,
  applyDurationTicksFromEditor,
  applyMelodyChromaticNudgeFromEditor,
  applyMelodyDegreeNudgeFromEditor,
  applyMelodyOctaveNudgeFromEditor,
  applyMelodyPitchDegreeFromEditor,
  applyMelodyRestFromEditor,
  applyNoteShortcutCommandFromEditor,
  type EditorKeyboardContext,
} from '../hooks/useKeyboard';
import { EntryModeToggle } from '../components/editor/EntryModeToggle';
import {
  buildScheduledPlayEvents,
  collectActiveMidiNotesAtScheduledEvents,
} from '../engine/audio/songScheduler';
import {
  formatTransportBeat,
  getPlaybackEngine,
  getPlaybackInitErrorMessage,
} from '../engine/audio';
import { useAuthStore } from '../store/authStore';
import { syncPlaybackEngineWithSong, usePlaybackStore } from '../store/playbackStore';
import {
  withResetZoom,
  withScrollYDelta,
  withZoomIn,
  withZoomOut,
  withZoomYIn,
  withZoomYOut,
  withZoomYReset,
} from '../utils/viewportNavigation';
import { melodyRowHeightPx } from '../utils/staffSpacing';
import { computeMelodyVoicePitchRanges, melodyPitchRangeRowCount } from '../engine/renderer/layout';
import { readPlainTextFromClipboard, writePlainTextToClipboard } from '../utils/clipboardTransport';
import { parseSelectionClipboardPayloadJson } from '../utils/selectionClipboard';
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
import { keyScaleTargetMeasureIndex } from './keyScaleTargetMeasureIndex';

/** TASK-3.4: idle delay after the last edit before auto PUT (coalesces rapid edits). */
const AUTOSAVE_DEBOUNCE_MS = 1500;

/** TASK-7.2 — `ShortcutCommandId` → ticks (PAT-004); wired through `createShortcutManager` `onCommand`. */
const NOTE_DURATION_COMMAND_TICKS: Partial<Record<ShortcutCommandId, number>> = {
  setNoteDurationWhole: 192,
  setNoteDurationHalf: 96,
  setNoteDurationQuarter: 48,
  setNoteDurationEighth: 24,
  setNoteDurationSixteenth: 12,
  setNoteDurationThirtySecond: 6,
};

/** TASK-7.1 — left chord palette rail sizing contract (UX §3 + OB-6 / RA-213 tuning). */
const CHORD_PALETTE_MIN_WIDTH_PX = 240;
const CHORD_PALETTE_DEFAULT_WIDTH_PX = 240;
const CHORD_PALETTE_MAX_WIDTH_PX = 400;
const CHORD_PALETTE_COLLAPSED_WIDTH_PX = 48;
const RIGHT_PROPERTIES_PANEL_WIDTH_PX = 192;

/** Compare the song snapshot we PUT with current store state to detect edits during an in-flight save. */
function songMatchesSentBaseline(sent: SongData, now: SongData): boolean {
  return JSON.stringify(sent) === JSON.stringify(now);
}

/** True when focus is on the grid canvas (role + aria contract from EditorCanvas). */
function isSongEditorCanvasFocused(active: EventTarget | null): boolean {
  return (
    active instanceof HTMLCanvasElement &&
    active.getAttribute('role') === 'application' &&
    (active.getAttribute('aria-label')?.startsWith('Song editor') ?? false)
  );
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
  const editNoteBatch = useSongStore((s) => s.editNoteBatch);
  const undo = useSongStore((s) => s.undo);
  const redo = useSongStore((s) => s.redo);
  const canUndo = useSongStore((s) => s.canUndo);
  const canRedo = useSongStore((s) => s.canRedo);
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
  const metronomeEnabled = usePlaybackStore((s) => s.metronomeEnabled);
  const recordArmed = usePlaybackStore((s) => s.recordArmed);
  const setMetronomeEnabled = usePlaybackStore((s) => s.setMetronomeEnabled);
  const setRecordArmed = usePlaybackStore((s) => s.setRecordArmed);

  const showErrorToast = useToastStore((s) => s.showError);
  const showSuccessToast = useToastStore((s) => s.showSuccess);

  const [projectName, setProjectName] = useState<string | null>(null);
  /** `ready` = editor can render; for `/editor/:id` we wait for GET (or bootstrap state). */
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready'>(() =>
    projectId ? 'loading' : 'ready',
  );
  const [saveBusy, setSaveBusy] = useState(false);
  /** UX §8 — lightweight persistence cue when autosave success is silent (no toast). */
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
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
  const labelMode = useUIStore((s) => s.labelMode);
  const staffSpacing = useUIStore((s) => s.staffSpacing);
  const setEntryMode = useUIStore((s) => s.setEntryMode);
  const setShowGuides = useUIStore((s) => s.setShowGuides);
  const setColorScheme = useUIStore((s) => s.setColorScheme);
  const setLabelMode = useUIStore((s) => s.setLabelMode);
  const setStaffSpacing = useUIStore((s) => s.setStaffSpacing);
  const activePanels = useUIStore((s) => s.activePanels);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const melodyVoiceVisible = useUIStore((s) => s.melodyVoiceVisible);
  const inactiveMelodyDisplayMode = useUIStore((s) => s.inactiveMelodyDisplayMode);
  const smartOctaveEnabled = useUIStore((s) => s.smartOctaveEnabled);
  const mixerOpen = activePanels.has('mixer');
  const settingsOpen = activePanels.has('settings');
  const pianoOpen = activePanels.has('piano');
  const progressionsOpen = activePanels.has('progressions');

  const [selectedMeasures, setSelectedMeasures] = useState<[number, number] | null>(null);
  const [tempoMeterDialogOpen, setTempoMeterDialogOpen] = useState(false);
  const editorCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const [editorCanvasContentWidth, setEditorCanvasContentWidth] = useState(0);
  const [chordPaletteWidthPx, setChordPaletteWidthPx] = useState(CHORD_PALETTE_DEFAULT_WIDTH_PX);
  /** Shared with `EditorCanvas` keyboard + chord palette (TASK-5.1). */
  const keyboardTargetMeasureRef = useRef<number | null>(null);
  const textDurationArmedRef = useRef(false);
  const [currentDurationTicks, setCurrentDurationTicks] = useState(48);
  /** UI-W3 — left-panel Chromatic toggle: new melody notes default to `chromatic: 1` when on (PAT-018). */
  const [melodyChromaticEntryActive, setMelodyChromaticEntryActive] = useState(false);
  const [chordPaletteExpanded, setChordPaletteExpanded] = useState(true);
  const [keyScaleDialogOpen, setKeyScaleDialogOpen] = useState(false);
  const keyScaleTriggerRef = useRef<HTMLButtonElement>(null);
  const mixerTriggerRef = useRef<HTMLButtonElement>(null);
  const progressionsOverlayTriggerRef = useRef<HTMLButtonElement | null>(null);
  const chordPaletteResizeDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const keyScaleTargetMeasure = useMemo(
    () => keyScaleTargetMeasureIndex(selectedMeasures, selection),
    [selectedMeasures, selection],
  );
  const [chordPaletteMode, setChordPaletteMode] = useState<
    'diatonic' | 'borrowed' | 'secondary' | 'search'
  >('diatonic');
  const [chordPaletteLibraryTab, setChordPaletteLibraryTab] = useState<
    'magic' | 'popular' | 'search' | 'progressions' | 'bassSets'
  >('magic');

  const transportKeyMeterLabels = useMemo(() => {
    const mi = keyScaleTargetMeasure;
    const m = getMeterAtMeasure(song, mi);
    return {
      keyLabel: `${getKeyAtMeasure(song, mi)} ${getScaleAtMeasure(song, mi)}`,
      meterLabel: `${m.numerator}/${m.denominator}`,
    };
  }, [song, keyScaleTargetMeasure]);

  const measuresPerLine = useMemo(() => {
    /** ASSUMPTIONS: using the active editor host width and current viewport.startMeasure meter keeps packing
     * aligned to local time signature without adding an extra full-measure scan for worst-case width.
     * This can under-pack by design when future measures are wider than the start measure.
     */
    const m = getMeterAtMeasure(song, viewport.startMeasure);
    const denominator = Number.isFinite(m.denominator) && m.denominator > 0 ? m.denominator : 4;
    const numerator = Number.isFinite(m.numerator) ? m.numerator : 4;
    // Convert meter to quarter-beat width so mixed signatures (like 6/8) use quarter-equivalent beats per measure.
    const beatsPerMeasure = Math.max(1, (numerator / denominator) * 4);
    return computeMeasuresPerLine({
      canvasWidthPx: editorCanvasContentWidth,
      zoom: viewport.zoom,
      beatsPerMeasure,
    });
  }, [editorCanvasContentWidth, song, viewport.startMeasure, viewport.zoom]);

  const handleZoomInTransport = useCallback(() => {
    setViewport(withZoomIn(useUIStore.getState().viewport));
  }, [setViewport]);

  const handleZoomOutTransport = useCallback(() => {
    setViewport(withZoomOut(useUIStore.getState().viewport));
  }, [setViewport]);

  const handleZoomResetTransport = useCallback(() => {
    setViewport(withResetZoom(useUIStore.getState().viewport));
  }, [setViewport]);

  const handleZoomYInTransport = useCallback(() => {
    setViewport(withZoomYIn(useUIStore.getState().viewport));
  }, [setViewport]);

  const handleZoomYOutTransport = useCallback(() => {
    setViewport(withZoomYOut(useUIStore.getState().viewport));
  }, [setViewport]);

  const handleZoomYResetTransport = useCallback(() => {
    setViewport(withZoomYReset(useUIStore.getState().viewport));
  }, [setViewport]);

  const clampChordPaletteWidthPx = useCallback((candidatePx: number): number => {
    return Math.min(CHORD_PALETTE_MAX_WIDTH_PX, Math.max(CHORD_PALETTE_MIN_WIDTH_PX, candidatePx));
  }, []);

  const updateChordPaletteWidthOnDrag = useCallback(
    (event: MouseEvent) => {
      const drag = chordPaletteResizeDragRef.current;
      if (!drag) {
        return;
      }
      const nextPx = clampChordPaletteWidthPx(drag.startWidth + (event.clientX - drag.startX));
      setChordPaletteWidthPx(nextPx);
    },
    [clampChordPaletteWidthPx],
  );

  const finishChordPaletteResize = useCallback(() => {
    chordPaletteResizeDragRef.current = null;
    window.removeEventListener('mousemove', updateChordPaletteWidthOnDrag);
    window.removeEventListener('mouseup', finishChordPaletteResize);
  }, [updateChordPaletteWidthOnDrag]);

  const startChordPaletteResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!chordPaletteExpanded || event.button !== 0) return;
      event.preventDefault();
      chordPaletteResizeDragRef.current = {
        startX: event.clientX,
        startWidth: chordPaletteWidthPx,
      };
      window.addEventListener('mousemove', updateChordPaletteWidthOnDrag);
      window.addEventListener('mouseup', finishChordPaletteResize);
    },
    [chordPaletteExpanded, chordPaletteWidthPx, finishChordPaletteResize, updateChordPaletteWidthOnDrag],
  );

  useEffect(() => {
    return () => {
      finishChordPaletteResize();
    };
  }, [finishChordPaletteResize]);

  const getShortcutContext = useCallback((): ShortcutContext => {
    return {
      hasModalOpen: keyScaleDialogOpen || tempoMeterDialogOpen || mixerOpen || progressionsOpen,
      isTextEditing: isEditableKeyboardTarget(document.activeElement),
      hasEditorFocus: isSongEditorCanvasFocused(document.activeElement),
      isPlaying: usePlaybackStore.getState().isPlaying,
    };
  }, [keyScaleDialogOpen, tempoMeterDialogOpen, mixerOpen, progressionsOpen]);

  const getSongAfterMutation = useCallback(() => useSongStore.getState().song, []);
  const getSelectionAfterMutation = useCallback(() => useUIStore.getState().selection, []);

  const setProgressionsPanelOpen = useCallback(
    (nextOpen: boolean): void => {
      const isOpen = activePanels.has('progressions');
      if (nextOpen && !isOpen) {
        togglePanel('progressions');
      }
      if (!nextOpen && isOpen) {
        togglePanel('progressions');
      }
    },
    [activePanels, togglePanel],
  );

  /**
   * TASK-7.2–7.5 — PAT-027 command dispatch from `createShortcutManager` (runs before `handleEditorKeydown` in useKeyboard).
   *
   * Precedence (TASK-7.5): `moveSelectionLeft` / `moveSelectionRight` use the same `navigateSelection` math as legacy
   * `ArrowLeft`/`ArrowRight` in `handleEditorKeydown`. When the canvas has editor focus, the registry consumes those
   * keys first (editor scope) and legacy handling is skipped. Without canvas focus, editor-scoped chords do not match
   * and the legacy arrow path still runs — so selection can move when focus is elsewhere non-text, matching pre–7.5 behavior.
   */
  const durationShortcutCommandRef = useRef<(id: ShortcutCommandId) => void>(() => {});

  const shortcutManager = useMemo(
    () =>
      createShortcutManager({
        onCommand: (id) => durationShortcutCommandRef.current(id),
      }),
    [],
  );

  durationShortcutCommandRef.current = (id: ShortcutCommandId) => {
    // TASK-7.5 — viewport (zoom / scroll) reads fresh UIStore to avoid stale React closures in the ref.
    if (id === 'zoomIn') {
      setViewport(withZoomIn(useUIStore.getState().viewport));
      return;
    }
    if (id === 'zoomOut') {
      setViewport(withZoomOut(useUIStore.getState().viewport));
      return;
    }
    if (id === 'resetZoom') {
      setViewport(withResetZoom(useUIStore.getState().viewport));
      return;
    }
    if (id === 'scrollUp') {
      const ui = useUIStore.getState();
      const songNow = useSongStore.getState().song;
      const activeRange = computeMelodyVoicePitchRanges(songNow)[ui.activeVoice];
      const melodyRowCount = melodyPitchRangeRowCount(activeRange);
      const step = melodyRowHeightPx(ui.staffSpacing) * (ui.viewport.zoomY ?? 1);
      setViewport(withScrollYDelta(ui.viewport, -step, melodyRowCount, step));
      return;
    }
    if (id === 'scrollDown') {
      const ui = useUIStore.getState();
      const songNow = useSongStore.getState().song;
      const activeRange = computeMelodyVoicePitchRanges(songNow)[ui.activeVoice];
      const melodyRowCount = melodyPitchRangeRowCount(activeRange);
      const step = melodyRowHeightPx(ui.staffSpacing) * (ui.viewport.zoomY ?? 1);
      setViewport(withScrollYDelta(ui.viewport, step, melodyRowCount, step));
      return;
    }
    if (id === 'moveSelectionLeft' || id === 'moveSelectionRight') {
      const songNow = useSongStore.getState().song;
      const ui = useUIStore.getState();
      const dir = id === 'moveSelectionLeft' ? (-1 as const) : (1 as const);
      const next = navigateSelection(
        songNow,
        ui.viewport,
        ui.selection,
        ui.activeVoice,
        dir,
        ui.entryMode,
      );
      if (next) ui.setSelection(next);
      return;
    }

    // TASK-7.5 — transport: `playPause` / `stopPlayback` / `rewindPlayback` use global scope (justified: Hookpad-style
    // transport from the shell without canvas focus). Still gated by modal + text editing in ShortcutManager.
    if (id === 'undo') {
      undo();
      return;
    }
    if (id === 'redo') {
      redo();
      return;
    }
    if (id === 'playPause') {
      void (async () => {
        const before = usePlaybackStore.getState();
        if (before.initStatus === 'ready') {
          if (before.isPlaying) before.pause();
          else before.play();
          return;
        }
        await before.initializeAudio();
        const st = usePlaybackStore.getState();
        if (st.initStatus === 'ready') {
          if (!st.isPlaying) st.play();
        } else if (st.initErrorCode) {
          showErrorToast(getPlaybackInitErrorMessage(st.initErrorCode));
        }
      })().catch((err: unknown) => {
        console.error(err);
      });
      return;
    }
    if (id === 'stopPlayback') {
      void (async () => {
        if (usePlaybackStore.getState().initStatus !== 'ready') {
          await usePlaybackStore.getState().initializeAudio();
        }
        usePlaybackStore.getState().stop();
      })().catch((err: unknown) => {
        console.error(err);
      });
      return;
    }
    if (id === 'rewindPlayback') {
      void (async () => {
        if (usePlaybackStore.getState().initStatus !== 'ready') {
          await usePlaybackStore.getState().initializeAudio();
        }
        usePlaybackStore.getState().rewind();
      })().catch((err: unknown) => {
        console.error(err);
      });
      return;
    }

    if (id === 'copySelection') {
      void (async () => {
        const payload = useSongStore.getState().buildSelectionClipboardPayload();
        if (!payload) return;
        await writePlainTextToClipboard(JSON.stringify(payload));
      })();
      return;
    }
    if (id === 'pasteSelection') {
      void (async () => {
        const text = await readPlainTextFromClipboard();
        if (text == null) return;
        const parsed = parseSelectionClipboardPayloadJson(text);
        if (!parsed) return;
        useSongStore.getState().applySelectionClipboardPayload(parsed);
      })();
      return;
    }
    if (id === 'splitSelection' || id === 'tieSelection' || id === 'toggleTriplet') {
      const kb: EditorKeyboardContext = {
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
        editNoteBatch,
        onSelectionChange: setSelection,
        shortcutManager,
        getShortcutContext,
        melodyChromaticEntryActive,
        smartOctaveEnabled,
      };
      applyNoteShortcutCommandFromEditor(kb, id);
      return;
    }
    const ticks = NOTE_DURATION_COMMAND_TICKS[id];
    if (ticks === undefined) return;
    const kb: EditorKeyboardContext = {
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
      editNoteBatch,
      onSelectionChange: setSelection,
      shortcutManager,
      getShortcutContext,
      melodyChromaticEntryActive,
      smartOctaveEnabled,
    };
    applyDurationTicksFromEditor(kb, ticks);
  };

  useEffect(() => {
    const unsubs = [
      shortcutManager.registerShortcut({
        id: 'setNoteDurationWhole',
        chord: 'H',
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'setNoteDurationHalf',
        chord: 'J',
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'setNoteDurationQuarter',
        chord: 'K',
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'setNoteDurationEighth',
        chord: 'L',
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'setNoteDurationSixteenth',
        chord: ';',
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'setNoteDurationThirtySecond',
        chord: '`',
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'setNoteDurationThirtySecond',
        chord: "'",
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'splitSelection',
        chord: TASK73_EDITOR_SHORTCUT_CHORDS.splitSelection,
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'tieSelection',
        chord: TASK73_EDITOR_SHORTCUT_CHORDS.tieSelection,
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'toggleTriplet',
        chord: TASK73_EDITOR_SHORTCUT_CHORDS.toggleTriplet,
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'copySelection',
        chord: 'Ctrl+C',
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'copySelection',
        chord: 'Meta+C',
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'pasteSelection',
        chord: 'Ctrl+V',
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'pasteSelection',
        chord: 'Meta+V',
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      // TASK-7.5 — navigation + zoom (editor scope; default chords in task75NavigationShortcutChords).
      shortcutManager.registerShortcut({
        id: 'zoomIn',
        chord: TASK75_NAVIGATION_SHORTCUT_CHORDS.zoomInPrimary,
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'zoomIn',
        chord: TASK75_NAVIGATION_SHORTCUT_CHORDS.zoomInShifted,
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'zoomOut',
        chord: TASK75_NAVIGATION_SHORTCUT_CHORDS.zoomOut,
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'resetZoom',
        chord: TASK75_NAVIGATION_SHORTCUT_CHORDS.resetZoom,
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'scrollUp',
        chord: TASK75_NAVIGATION_SHORTCUT_CHORDS.scrollUp,
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'scrollDown',
        chord: TASK75_NAVIGATION_SHORTCUT_CHORDS.scrollDown,
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'moveSelectionLeft',
        chord: TASK75_NAVIGATION_SHORTCUT_CHORDS.moveSelectionLeft,
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'moveSelectionRight',
        chord: TASK75_NAVIGATION_SHORTCUT_CHORDS.moveSelectionRight,
        scope: 'editor',
        conflictPolicy: 'replace',
      }),
      // Transport: global scope so Play/Stop/Rewind work without canvas focus; modal/text still block (PAT-027).
      shortcutManager.registerShortcut({
        id: 'playPause',
        chord: TASK75_TRANSPORT_SHORTCUT_CHORDS.playPause,
        scope: 'global',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'stopPlayback',
        chord: TASK75_TRANSPORT_SHORTCUT_CHORDS.stopPlayback,
        scope: 'global',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'rewindPlayback',
        chord: TASK75_TRANSPORT_SHORTCUT_CHORDS.rewindPlayback,
        scope: 'global',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'undo',
        chord: TASK75_TRANSPORT_SHORTCUT_CHORDS.undo,
        scope: 'global',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'undo',
        chord: TASK75_TRANSPORT_SHORTCUT_CHORDS.undoMac,
        scope: 'global',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'redo',
        chord: TASK75_TRANSPORT_SHORTCUT_CHORDS.redo,
        scope: 'global',
        conflictPolicy: 'replace',
      }),
      shortcutManager.registerShortcut({
        id: 'redo',
        chord: TASK75_TRANSPORT_SHORTCUT_CHORDS.redoMac,
        scope: 'global',
        conflictPolicy: 'replace',
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [shortcutManager]);

  const paletteMeasureIndex = useMemo(
    () => resolveTargetMeasureIndex(selection, viewport, song),
    [selection, viewport, song],
  );
  const paletteKey = getKeyAtMeasure(song, paletteMeasureIndex);
  const paletteScale = getScaleAtMeasure(song, paletteMeasureIndex);

  const pianoPlayheadTick = useMemo(() => {
    const starts = getMeasureStartTicks(song);
    return playbackTick ?? starts[paletteMeasureIndex] ?? 0;
  }, [song, playbackTick, paletteMeasureIndex]);

  const scheduledPlayEvents = useMemo(
    () => buildScheduledPlayEvents(song, theoryEngine, { melodyVoiceVisible }),
    [song, melodyVoiceVisible],
  );

  const pianoHighlightedMidi = useMemo(
    () => collectActiveMidiNotesAtScheduledEvents(scheduledPlayEvents, song, pianoPlayheadTick),
    [scheduledPlayEvents, song, pianoPlayheadTick],
  );

  const pianoTheoryMeasure = useMemo(
    () => measureIndexFromAbsoluteTick(song, pianoPlayheadTick),
    [song, pianoPlayheadTick],
  );

  const pianoHomeKey = useMemo(
    () => getKeyAtMeasure(song, pianoTheoryMeasure),
    [song, pianoTheoryMeasure],
  );
  const pianoScaleForKeyboard = useMemo(
    () => getScaleAtMeasure(song, pianoTheoryMeasure),
    [song, pianoTheoryMeasure],
  );

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
        editNoteBatch,
        onSelectionChange: setSelection,
        shortcutManager,
        getShortcutContext,
        melodyChromaticEntryActive,
        smartOctaveEnabled,
      };
      applyChordPalettePayloadFromEditor(ctx, chord);
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
      editNoteBatch,
      setSelection,
      shortcutManager,
      getShortcutContext,
      melodyChromaticEntryActive,
      smartOctaveEnabled,
    ],
  );

  const handleChordPaletteLibraryTabChange = useCallback(
    (nextTab: 'magic' | 'popular' | 'search' | 'progressions' | 'bassSets'): void => {
      if (nextTab === 'progressions' && document.activeElement instanceof HTMLButtonElement) {
        progressionsOverlayTriggerRef.current = document.activeElement;
      }

      setChordPaletteLibraryTab(nextTab);
      setProgressionsPanelOpen(nextTab === 'progressions');
    },
    [setProgressionsPanelOpen],
  );

  const handlePlacementDurationTicks = useCallback(
    (ticks: number) => {
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
        editNoteBatch,
        onSelectionChange: setSelection,
        shortcutManager,
        getShortcutContext,
        melodyChromaticEntryActive,
        smartOctaveEnabled,
      };
      applyDurationTicksFromEditor(ctx, ticks);
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
      editNoteBatch,
      setSelection,
      shortcutManager,
      getShortcutContext,
      melodyChromaticEntryActive,
      smartOctaveEnabled,
    ],
  );

  const melodyKeyboardCtx = useCallback((): EditorKeyboardContext => {
    return {
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
      editNoteBatch,
      onSelectionChange: setSelection,
      shortcutManager,
      getShortcutContext,
      melodyChromaticEntryActive,
      smartOctaveEnabled,
    };
  }, [
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
    editNoteBatch,
    setSelection,
    shortcutManager,
    getShortcutContext,
    melodyChromaticEntryActive,
    smartOctaveEnabled,
  ]);

  const handleMelodyPitchDegree = useCallback(
    (degree: ScaleDegree) => {
      applyMelodyPitchDegreeFromEditor(melodyKeyboardCtx(), degree);
    },
    [melodyKeyboardCtx],
  );

  const handleMelodyRest = useCallback(() => {
    applyMelodyRestFromEditor(melodyKeyboardCtx());
  }, [melodyKeyboardCtx]);

  const handleMelodyRaiseHalf = useCallback(() => {
    applyMelodyChromaticNudgeFromEditor(melodyKeyboardCtx(), 1);
  }, [melodyKeyboardCtx]);

  const handleMelodyLowerHalf = useCallback(() => {
    applyMelodyChromaticNudgeFromEditor(melodyKeyboardCtx(), -1);
  }, [melodyKeyboardCtx]);

  const handleMelodyRaise = useCallback(() => {
    applyMelodyDegreeNudgeFromEditor(melodyKeyboardCtx(), 1);
  }, [melodyKeyboardCtx]);

  const handleMelodyRaiseOctave = useCallback(() => {
    applyMelodyOctaveNudgeFromEditor(melodyKeyboardCtx(), 1);
  }, [melodyKeyboardCtx]);

  const handleMelodyLower = useCallback(() => {
    applyMelodyDegreeNudgeFromEditor(melodyKeyboardCtx(), -1);
  }, [melodyKeyboardCtx]);

  const handleMelodyLowerOctave = useCallback(() => {
    applyMelodyOctaveNudgeFromEditor(melodyKeyboardCtx(), -1);
  }, [melodyKeyboardCtx]);

  const handleMelodyAdd = useCallback(() => {
    applyMelodyAddFromEditor(melodyKeyboardCtx());
  }, [melodyKeyboardCtx]);

  const handleMelodySplit = useCallback(() => {
    applyNoteShortcutCommandFromEditor(melodyKeyboardCtx(), 'splitSelection');
  }, [melodyKeyboardCtx]);

  const handleMelodyTie = useCallback(() => {
    applyNoteShortcutCommandFromEditor(melodyKeyboardCtx(), 'tieSelection');
  }, [melodyKeyboardCtx]);

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
  }, [song, melodyVoiceVisible]);

  // Load song for `/editor/:projectId` (GET) or hydrate from navigation state after POST /projects (no duplicate GET).
  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      editorBootstrapHydratedIdRef.current = null;
      clearAllEditorPostBootstrap();
      // Vitest seeds `songStore` before mount (`import.meta.env.MODE === 'test'`); avoid clobbering.
      if (import.meta.env.MODE !== 'test') {
        loadSong(buildDefaultSong());
      }
      setProjectName(null);
      setLoadStatus('ready');
      return;
    }

    // POST-bootstrap ref is only meaningful for the current route param; clear when switching projects.
    if (
      editorBootstrapHydratedIdRef.current != null &&
      editorBootstrapHydratedIdRef.current !== projectId
    ) {
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
    setLastSavedAt(null);
  }, [projectId]);

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
          setLastSavedAt(new Date());
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

  useEffect(() => {
    const host = editorCanvasHostRef.current;
    if (!host) return;

    const syncEditorCanvasWidth = () => {
      // In headless/jsdom environments `clientWidth` can be 0 even when a test width is set
      // on the container. Fall back to `window.innerWidth` so measure packing remains responsive.
      const hostWidth = Math.max(0, host.clientWidth);
      const fallbackWidth = Math.max(0, window?.innerWidth ?? 0);
      const nextWidth = hostWidth > 0 ? hostWidth : fallbackWidth;
      setEditorCanvasContentWidth(nextWidth);
    };

    syncEditorCanvasWidth();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(syncEditorCanvasWidth);
      ro.observe(host);
    }
    window.addEventListener('resize', syncEditorCanvasWidth);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncEditorCanvasWidth);
    };
  }, []);

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

  const transportLeadingControls = (
    <>
      <span className="hidden min-w-0 max-w-[12rem] overflow-hidden text-xs font-medium text-[var(--color-text-secondary,#4B5563)] xl:inline-block xl:truncate">
        {headerTitle}
      </span>
      {user ? <span className="text-sm text-[var(--color-text-secondary,#4B5563)]">{user.displayName}</span> : null}
      {projectId ? (
        <button
          type="button"
          disabled={saveDisabled}
          onClick={() => void handleSave()}
          className="inline-flex min-h-8 min-w-11 items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-3 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
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
        className="inline-flex min-h-8 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
      >
        Projects
      </button>
      <EntryModeToggle mode={entryMode} onToggle={toggleEntryMode} />
      <Tooltip label="Active melody voice (Ctrl+1–4)">
        <span
          tabIndex={0}
          className="inline-flex min-h-8 min-w-11 cursor-default items-center justify-center rounded-md border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface-muted,#F9FAFB)] px-2 text-[12px] font-medium text-[var(--color-text-secondary,#4B5563)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          aria-live="polite"
        >
          Voice {activeVoice + 1}
        </span>
      </Tooltip>
      <button
        type="button"
        onClick={() => setChordPaletteExpanded((o) => !o)}
        aria-expanded={chordPaletteExpanded}
        aria-controls="vybpad-panel-chords"
        className="inline-flex min-h-8 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
      >
        Chords
      </button>
      <button
        type="button"
        ref={mixerTriggerRef}
        onClick={() => togglePanel('mixer')}
        aria-expanded={mixerOpen}
        aria-pressed={mixerOpen}
        aria-controls={mixerOpen ? 'vybpad-panel-mixer' : undefined}
        className="inline-flex min-h-8 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
      >
        <span aria-hidden="true" className="text-sm leading-none">
          🎚
        </span>
        <span>Mixer</span>
      </button>
      <button
        type="button"
        onClick={() => togglePanel('settings')}
        aria-expanded={settingsOpen}
        aria-pressed={settingsOpen}
        aria-controls={settingsOpen ? 'vybpad-panel-settings' : undefined}
        className="inline-flex min-h-8 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
      >
        Settings
      </button>
      <button
        type="button"
        onClick={() => togglePanel('piano')}
        aria-expanded={pianoOpen}
        aria-pressed={pianoOpen}
        aria-controls={pianoOpen ? 'vybpad-panel-piano' : undefined}
        className="inline-flex min-h-8 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
      >
        Piano
      </button>
      <button
        ref={keyScaleTriggerRef}
        type="button"
        onClick={() => setKeyScaleDialogOpen(true)}
        className="inline-flex min-h-8 min-w-11 items-center justify-center rounded-md px-3 text-sm font-medium text-[var(--color-primary,#4F46E5)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
      >
        Key / scale
      </button>
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="inline-flex min-h-8 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
      >
        Log out
      </button>
    </>
  );

  const chordPropertyContext = useMemo(() => {
    if (selection?.type !== 'chord' || !selection.eventIds?.[0]) return null;
    const id = selection.eventIds[0];
    const ch = song.measures[selection.measureIndex]?.chords.find((c) => c.id === id);
    return ch ? { measureIndex: selection.measureIndex, chord: ch } : null;
  }, [selection, song]);

  const handleChordPropertyUpdate = useCallback(
    (measureIndex: number, chordId: string, changes: Partial<ChordEvent>) => {
      editChord(measureIndex, { type: 'update', chordId, changes });
    },
    [editChord],
  );

  const handleSecondaryCycle = useCallback(() => {
    if (selection?.type !== 'chord' || !selection.eventIds?.[0]) return;
    const id = selection.eventIds[0];
    const ch = song.measures[selection.measureIndex]?.chords.find((c) => c.id === id);
    if (!ch) return;
    const k = getKeyAtMeasure(song, selection.measureIndex);
    const sc = getScaleAtMeasure(song, selection.measureIndex);
    const changes = cycleSecondaryChordEdit(ch, k, sc);
    if (Object.keys(changes).length === 0) return;
    editChord(selection.measureIndex, { type: 'update', chordId: id, changes });
  }, [editChord, selection, song]);

  const handleSecondaryClear = useCallback(() => {
    if (selection?.type !== 'chord' || !selection.eventIds?.[0]) return;
    const id = selection.eventIds[0];
    const ch = song.measures[selection.measureIndex]?.chords.find((c) => c.id === id);
    if (!ch) return;
    const k = getKeyAtMeasure(song, selection.measureIndex);
    const sc = getScaleAtMeasure(song, selection.measureIndex);
    const changes = clearSecondaryChordEdit(ch, k, sc);
    if (Object.keys(changes).length === 0) return;
    editChord(selection.measureIndex, { type: 'update', chordId: id, changes });
  }, [editChord, selection, song]);

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
    <div className="flex h-screen min-h-screen overflow-hidden flex-col bg-[var(--color-app-bg,#F3F4F6)] text-sm text-[var(--color-text-primary,#111827)]">
      <header className="flex min-h-[48px] min-w-0 flex-wrap items-start justify-between gap-2 border-b border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 py-2 lg:hidden lg:flex-nowrap lg:overflow-x-auto">
        <div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">{headerTitle}</h1>
          {projectName ? (
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary,#4B5563)]">
              {projectName}
            </p>
          ) : null}
          {projectId && lastSavedAt ? (
            <p className="mt-1 text-xs text-[var(--color-text-muted,#9CA3AF)]" aria-live="polite">
              Last saved{' '}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(lastSavedAt)}
            </p>
          ) : null}
          <p className="mt-1 max-w-2xl text-xs leading-snug text-[var(--color-text-muted,#9CA3AF)]">
            Grid editor — click to select, drag to move, drag trailing edge to resize chords.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap" />
      </header>
      <TransportControls
        leadingContent={transportLeadingControls}
        isPlaying={isPlaying}
        tempo={song.metadata.tempo}
        currentBeat={currentBeatDisplay}
        initStatus={initStatus}
        initErrorCode={initErrorCode}
        onPlay={() => void handleTransportPlay()}
        onPause={playbackPause}
        onStop={playbackStop}
        onRewind={playbackRewind}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onTempoChange={(bpm) => {
          const n = Math.round(bpm);
          if (!Number.isFinite(n) || n < 20 || n > 300) return;
          updateMetadata({ tempo: n });
        }}
        recordArmed={recordArmed}
        onRecordToggle={() => setRecordArmed(!recordArmed)}
        metronomeEnabled={metronomeEnabled}
        onMetronomeToggle={() => setMetronomeEnabled(!metronomeEnabled)}
        zoomPercent={Math.round(viewport.zoom * 100)}
        onZoomIn={handleZoomInTransport}
        onZoomOut={handleZoomOutTransport}
        onZoomReset={handleZoomResetTransport}
        zoomYPercent={Math.round((viewport.zoomY ?? 1) * 100)}
        onZoomYIn={handleZoomYInTransport}
        onZoomYOut={handleZoomYOutTransport}
        onZoomYReset={handleZoomYResetTransport}
        keyLabel={transportKeyMeterLabels.keyLabel}
        meterLabel={transportKeyMeterLabels.meterLabel}
        onTempoMeterEdit={() => setTempoMeterDialogOpen(true)}
        loopContent={<LoopBar />}
        endContent={
          <>
            <MidiExportControls song={song} activeVoice={activeVoice} projectName={projectName} />
            <MidiDragExportControl />
          </>
        }
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
        <aside
          id="vybpad-panel-chords"
          className={
            chordPaletteExpanded
              ? 'relative flex min-h-0 min-w-[240px] shrink-0 flex-col border-r border-[var(--color-border,#E5E7EB)] bg-[var(--color-app-bg,#F3F4F6)] overflow-hidden overflow-x-hidden'
              : `flex min-h-0 w-[${CHORD_PALETTE_COLLAPSED_WIDTH_PX}px] shrink-0 flex-col items-center border-r border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] overflow-hidden overflow-x-hidden py-2`
          }
          style={
            chordPaletteExpanded
              ? {
                  width: `${clampChordPaletteWidthPx(chordPaletteWidthPx)}px`,
                  minWidth: `${CHORD_PALETTE_MIN_WIDTH_PX}px`,
                }
              : { width: `${CHORD_PALETTE_COLLAPSED_WIDTH_PX}px` }
          }
          role="complementary"
          aria-label="Chord palette panel"
        >
          {chordPaletteExpanded ? (
            <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize chord palette rail"
              data-testid="vybpad-panel-chords-resize-handle"
              className="absolute right-0 top-0 z-10 h-full w-2 touch-none cursor-col-resize"
              onMouseDown={startChordPaletteResize}
            >
              <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-[var(--color-border-strong,#D1D5DB)]" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <PlacementDurationControls
                currentDurationTicks={currentDurationTicks}
                onDurationTicks={handlePlacementDurationTicks}
              />
              <MelodyEntryPanel
                currentKey={paletteKey}
                currentScale={paletteScale}
                entryMode={entryMode}
                melodyChromaticEntryActive={melodyChromaticEntryActive}
                onMelodyChromaticEntryToggle={() => setMelodyChromaticEntryActive((v) => !v)}
                onPitchDegree={handleMelodyPitchDegree}
                onRest={handleMelodyRest}
                onRaiseHalf={handleMelodyRaiseHalf}
                onRaise={handleMelodyRaise}
                onRaiseOctave={handleMelodyRaiseOctave}
                onLowerHalf={handleMelodyLowerHalf}
                onLower={handleMelodyLower}
                onLowerOctave={handleMelodyLowerOctave}
                onAdd={handleMelodyAdd}
                onSplit={handleMelodySplit}
                onTie={handleMelodyTie}
              />
              <div
                className="flex shrink-0 flex-col gap-2 border-b border-[var(--color-border,#E5E7EB)] px-3 pt-2 pb-2"
                role="group"
                aria-label="Chord palette mode"
              >
                <div className="flex gap-1 rounded-lg bg-[var(--color-surface-muted,#F9FAFB)] p-1">
                  <button
                    type="button"
                    aria-pressed={chordPaletteMode === 'diatonic'}
                    onClick={() => setChordPaletteMode('diatonic')}
                    className={
                      chordPaletteMode === 'diatonic'
                        ? 'inline-flex min-h-8 flex-1 items-center justify-center rounded-md bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] shadow-sm outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
                        : 'inline-flex min-h-8 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium text-[var(--color-text-secondary,#4B5563)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface,#FFFFFF)]/60 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
                    }
                  >
                    Diatonic
                  </button>
                  <button
                    type="button"
                    aria-pressed={chordPaletteMode === 'borrowed'}
                    onClick={() => setChordPaletteMode('borrowed')}
                    className={
                      chordPaletteMode === 'borrowed'
                        ? 'inline-flex min-h-8 flex-1 items-center justify-center rounded-md bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] shadow-sm outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
                        : 'inline-flex min-h-8 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium text-[var(--color-text-secondary,#4B5563)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface,#FFFFFF)]/60 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
                    }
                  >
                    Borrowed
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <ChordPalette
                  currentKey={paletteKey}
                  currentScale={paletteScale}
                  mode={chordPaletteMode}
                  onChordSelect={handleChordPaletteSelect}
                  libraryTab={chordPaletteLibraryTab}
                  onLibraryTabChange={handleChordPaletteLibraryTabChange}
                  onBrowseDefaultsReset={() => setChordPaletteMode('diatonic')}
                />
              </div>
            </div>
            </>
          ) : (
            <Tooltip label="Expand chord palette">
              <button
                type="button"
                aria-label="Expand chord palette"
                aria-expanded={false}
                aria-controls="vybpad-panel-chords"
                onClick={() => setChordPaletteExpanded(true)}
                className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] text-lg font-semibold leading-none text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
              >
                ›
              </button>
            </Tooltip>
          )}
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <main
            ref={editorCanvasHostRef}
            className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3"
            aria-busy={projectId ? loadStatus === 'loading' : false}
          >
            {projectId && loadStatus === 'loading' ? (
              <div
                className="flex min-h-[240px] flex-col items-center justify-center gap-3"
                role="status"
                aria-live="polite"
              >
                <div
                  className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-[var(--color-primary,#4F46E5)] border-t-transparent"
                  aria-hidden="true"
                />
                <p className="text-[12px] leading-snug text-[var(--color-text-muted,#9CA3AF)]">
                  Loading project…
                </p>
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
                labelMode={labelMode}
                staffSpacing={staffSpacing}
                onChordEdit={editChord}
                onNoteEdit={editNote}
                onNoteEditBatch={editNoteBatch}
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
                shortcutManager={shortcutManager}
                getShortcutContext={getShortcutContext}
                melodyChromaticEntryActive={melodyChromaticEntryActive}
                melodyVoiceVisible={melodyVoiceVisible}
                inactiveMelodyDisplayMode={inactiveMelodyDisplayMode}
                smartOctaveEnabled={smartOctaveEnabled}
              />
            )}
          </main>
          <MeasureBar
            measureCount={song.measures.length}
            selectedMeasures={selectedMeasures}
            measuresPerLine={measuresPerLine}
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
        <div
          className="flex min-h-0 shrink-0 flex-col self-stretch overflow-x-hidden overflow-y-auto border-l border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)]"
          style={{
            width: `${RIGHT_PROPERTIES_PANEL_WIDTH_PX}px`,
            minWidth: `${RIGHT_PROPERTIES_PANEL_WIDTH_PX}px`,
            maxWidth: `${RIGHT_PROPERTIES_PANEL_WIDTH_PX}px`,
          }}
        >
          <EditorPropertiesPanel
            selectionType={selection?.type ?? null}
            chordContext={chordPropertyContext}
            chordKey={
              chordPropertyContext != null ? getKeyAtMeasure(song, chordPropertyContext.measureIndex) : undefined
            }
            chordTheoryScale={
              chordPropertyContext != null
                ? getScaleAtMeasure(song, chordPropertyContext.measureIndex)
                : undefined
            }
            onChordUpdate={handleChordPropertyUpdate}
            onSecondaryCycle={handleSecondaryCycle}
            onSecondaryClear={handleSecondaryClear}
          />
          {settingsOpen ? (
            <div
              id="vybpad-panel-settings"
              className={
                pianoOpen
                  ? 'flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-t border-b border-[var(--color-border,#E5E7EB)]'
                  : 'flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-t border-[var(--color-border,#E5E7EB)]'
              }
            >
              <EditorSettingsPanel
                entryMode={entryMode}
                labelMode={labelMode}
                colorScheme={colorScheme}
                showGuides={showGuides}
                staffSpacing={staffSpacing}
                onEntryModeChange={setEntryMode}
                onLabelModeChange={setLabelMode}
                onColorSchemeChange={setColorScheme}
                onShowGuidesChange={setShowGuides}
                onStaffSpacingChange={setStaffSpacing}
              />
            </div>
          ) : null}
          {pianoOpen ? (
            <aside
              id="vybpad-panel-piano"
              className="flex min-h-0 min-w-0 shrink-0 flex-col overflow-y-auto border-t border-[var(--color-border,#E5E7EB)]"
              role="complementary"
              aria-labelledby="vybpad-piano-panel-title"
            >
              <PianoKeyboardPanel
                homeKey={pianoHomeKey}
                scale={pianoScaleForKeyboard}
                highlightedMidi={pianoHighlightedMidi}
              />
            </aside>
          ) : null}
        </div>
      </div>
      <MixerOverlay
        open={mixerOpen}
        bandConfig={song.bandConfig}
        onTrackChange={handleTrackChange}
        onClose={() => {
          if (mixerOpen) {
            togglePanel('mixer');
          }
        }}
        focusReturnTarget={mixerTriggerRef.current}
      />
      <ProgressionsOverlay
        open={progressionsOpen}
        currentKey={paletteKey}
        currentScale={paletteScale}
        onChordSelect={handleChordPaletteSelect}
        onClose={() => {
          if (progressionsOpen) {
            togglePanel('progressions');
          }
        }}
        focusReturnTarget={progressionsOverlayTriggerRef.current}
      />
      <KeyScaleChangeDialog
        open={keyScaleDialogOpen}
        measureIndex={keyScaleTargetMeasure}
        onClose={() => {
          setKeyScaleDialogOpen(false);
          queueMicrotask(() => keyScaleTriggerRef.current?.focus());
        }}
      />
      <TempoMeterAtMeasureDialog
        open={tempoMeterDialogOpen}
        measureIndex={keyScaleTargetMeasure}
        song={song}
        onDismiss={() => setTempoMeterDialogOpen(false)}
        onApply={(changes) => {
          setMeasureChanges(keyScaleTargetMeasure, changes);
        }}
      />
    </div>
  );
}
