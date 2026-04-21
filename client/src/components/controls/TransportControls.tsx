import type { ReactNode, Ref } from 'react';

import { getPlaybackInitErrorMessage } from '../../engine/audio';
import { type PlaybackInitErrorCode, type PlaybackInitStatus } from '../../store/playbackStore';

/** INTERFACES.md — `TransportControls` / `TransportControlsProps` (TASK-4.1 + UI-W6 + UI-W8). */
export interface TransportControlsProps {
  isPlaying: boolean;
  tempo: number;
  currentBeat: string;
  initStatus: PlaybackInitStatus;
  initErrorCode: PlaybackInitErrorCode | null;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRewind: () => void;
  onTempoChange: (bpm: number) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  /** Loop region controls (UI-W6 — folded into transport row; RA-11). */
  loopContent?: ReactNode;
  /** UI-R2-W8 (RA-20) — optional leading cluster before core controls (e.g. project/panel actions). */
  leadingContent?: ReactNode;
  /** Optional trailing cluster before final endContent (if present). */
  trailingContent?: ReactNode;
  /** Optional trailing slot (e.g. MIDI export / drag-to-desktop affordance); omit when unused. */
  endContent?: ReactNode;
  /** UI-W8 (RA-13) — record arm toggle; omit when unused. */
  recordArmed?: boolean;
  onRecordToggle?: () => void;
  /** UI-W8 (RA-14) — metronome / click toggle. */
  metronomeEnabled?: boolean;
  onMetronomeToggle?: () => void;
  /** UI-W8 (RA-16/21) — zoom readout and ± / reset; `zoomPercent` is 100 at default horizontal zoom. */
  zoomPercent?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  /** UI-R2-W7.2 (RA-210) — melody-row vertical zoom and ± / reset; `zoomYPercent` is 100 at default. */
  zoomYPercent?: number;
  onZoomYIn?: () => void;
  onZoomYOut?: () => void;
  onZoomYReset?: () => void;
  /** UI-W8 (RA-20) — key + meter readouts in top band; click opens tempo/meter edit when callback set. */
  keyLabel?: string;
  meterLabel?: string;
  onTempoMeterEdit?: () => void;
  toolbarRef?: Ref<HTMLDivElement>;
}

export function TransportControls({
  isPlaying,
  tempo,
  currentBeat,
  initStatus,
  initErrorCode,
  onPlay,
  onPause,
  onStop,
  onRewind,
  onTempoChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  loopContent,
  leadingContent,
  trailingContent,
  endContent,
  recordArmed,
  onRecordToggle,
  metronomeEnabled,
  onMetronomeToggle,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  zoomYPercent,
  onZoomYIn,
  onZoomYOut,
  onZoomYReset,
  keyLabel,
  meterLabel,
  onTempoMeterEdit,
  toolbarRef,
}: TransportControlsProps) {
  const playDisabled = initStatus === 'initializing';
  /** Pause / stop / rewind require a running engine (INTERFACES transport actions). */
  const transportLocked = initStatus !== 'ready';

  const showKeyMeterBand =
    (keyLabel != null && keyLabel !== '') ||
    (meterLabel != null && meterLabel !== '') ||
    onTempoMeterEdit != null;

  const showZoomCluster =
    zoomPercent != null || onZoomIn != null || onZoomOut != null || onZoomReset != null;
  const showZoomYCluster =
    zoomYPercent != null || onZoomYIn != null || onZoomYOut != null || onZoomYReset != null;

  return (
    <div
      ref={toolbarRef}
      data-testid="vybpad-transport-toolbar"
      data-ui-density="compact"
      role="toolbar"
      aria-label="Transport"
      aria-busy={initStatus === 'initializing' ? 'true' : undefined}
      data-audio-ready={initStatus === 'ready' ? 'true' : 'false'}
      className="flex min-w-0 flex-col border-b border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] lg:flex-nowrap"
    >
      {showKeyMeterBand ? (
        <div className="flex min-h-0 shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--color-border,#E5E7EB)] px-3 py-0.5">
          <div
            data-testid="vybpad-transport-key-meter-cluster"
            className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs leading-tight text-[var(--color-text-primary,#111827)]"
          >
            {keyLabel ? (
              <span className="font-medium tabular-nums text-[var(--color-text-primary,#111827)]">
                {keyLabel}
              </span>
            ) : null}
            {meterLabel ? (
              <span className="tabular-nums text-[var(--color-text-secondary,#4B5563)]">
                {keyLabel ? ' ' : ''}
                {meterLabel}
              </span>
            ) : null}
          </div>
          {onTempoMeterEdit ? (
            <button
              type="button"
              data-testid="vybpad-tempo-meter-edit"
              onClick={onTempoMeterEdit}
              className="inline-flex min-h-7 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-strong,#D1D5DB)] bg-transparent px-2 text-xs font-medium text-[var(--color-primary,#4F46E5)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            >
              Tempo / meter
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-12 min-w-0 flex-wrap items-center gap-2 px-3 lg:flex-nowrap lg:overflow-x-auto">
        {leadingContent ? (
          <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Leading transport controls">
            {leadingContent}
          </div>
        ) : null}
        <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Playback">
          <button
            type="button"
            data-testid="vybpad-transport-undo"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Undo"
            aria-pressed={undefined}
            disabled={canUndo !== true}
            onClick={onUndo}
          >
            Undo
          </button>
          <button
            type="button"
            data-testid="vybpad-transport-redo"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Redo"
            aria-pressed={undefined}
            disabled={canRedo !== true}
            onClick={onRedo}
          >
            Redo
          </button>
          {isPlaying ? (
            <button
              type="button"
              data-testid="vybpad-transport-pause"
              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-3 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              aria-label="Pause playback"
              aria-pressed="true"
              disabled={transportLocked}
              onClick={onPause}
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              data-testid="vybpad-transport-play"
              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-3 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              aria-label={initStatus === 'ready' ? 'Play' : 'Start audio and play'}
              disabled={playDisabled}
              onClick={onPlay}
            >
              {initStatus === 'initializing' ? 'Starting…' : 'Play'}
            </button>
          )}
          <button
            type="button"
          data-testid="vybpad-transport-stop"
            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Stop playback"
            disabled={transportLocked}
            onClick={onStop}
          >
            Stop
          </button>
          <button
            data-testid="vybpad-transport-rewind"
            type="button"
            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Rewind to start"
            disabled={transportLocked}
            onClick={onRewind}
          >
            Rewind
          </button>
        </div>

        <div
          data-testid="vybpad-transport-current-beat"
          className="flex min-h-8 min-w-[120px] shrink-0 items-center text-sm tabular-nums text-[var(--color-text-primary,#111827)]"
          aria-live="polite"
        >
          <span className="sr-only">Current position</span>
          <span aria-hidden="true">{currentBeat}</span>
        </div>

        <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--color-text-secondary,#4B5563)]">
          <span id="transport-tempo-label">Tempo</span>
          <input
            role="spinbutton"
            id="transport-tempo-input"
            type="number"
            min={20}
            max={300}
            value={String(tempo)}
            onChange={(e) => onTempoChange(Number(e.target.value))}
            className="h-8 w-20 rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-2 text-center text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none focus:border-[var(--color-primary,#4F46E5)] focus:ring-1 focus:ring-[var(--color-primary,#4F46E5)] disabled:opacity-50"
            aria-labelledby="transport-tempo-label"
          />
          <span className="text-[var(--color-text-muted,#9CA3AF)]" aria-hidden="true">
            BPM
          </span>
        </label>

        {onRecordToggle ? (
          <button
            type="button"
            data-testid="vybpad-transport-record"
            aria-label="Record arm"
            aria-pressed={recordArmed ?? false}
            onClick={onRecordToggle}
            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Rec
          </button>
        ) : null}

        {onMetronomeToggle ? (
          <button
            type="button"
            data-testid="vybpad-transport-metronome"
            aria-label="Metronome"
            aria-pressed={metronomeEnabled ?? false}
            onClick={onMetronomeToggle}
            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Click
          </button>
        ) : null}

        {/* Horizontal editor zoom (`viewport.zoom`) scales the grid only — not DOM / UI chrome (OB-6). */}
        {showZoomCluster ? (
          <div
            className="flex shrink-0 items-center gap-1 border-l border-[var(--color-border,#E5E7EB)] pl-2"
            role="group"
            aria-label="Editor canvas zoom"
          >
            <span
              data-testid="vybpad-zoom-readout"
              className="min-w-[3.25rem] text-center text-sm tabular-nums text-[var(--color-text-secondary,#4B5563)]"
            >
              {zoomPercent != null ? `${zoomPercent}%` : '—'}
            </span>
            <button
              type="button"
              data-testid="vybpad-zoom-out"
              aria-label="Zoom out"
              disabled={onZoomOut == null}
              onClick={onZoomOut}
              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-2 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
            >
              −
            </button>
            <button
              type="button"
              data-testid="vybpad-zoom-in"
              aria-label="Zoom in"
              disabled={onZoomIn == null}
              onClick={onZoomIn}
              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-2 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
            >
              +
            </button>
            <button
              type="button"
              data-testid="vybpad-zoom-reset"
              aria-label="Reset zoom to 1:1 (100%)"
              disabled={onZoomReset == null}
              onClick={onZoomReset}
              className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-2 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
            >
              1:1
            </button>
          </div>
        ) : null}

        {showZoomYCluster ? (
          <div
            className="flex shrink-0 items-center gap-1 border-l border-[var(--color-border,#E5E7EB)] pl-2"
            role="group"
            aria-label="Editor melody zoom"
          >
            <span
              data-testid="vybpad-zoom-y-readout"
              className="min-w-[3.25rem] text-center text-sm tabular-nums text-[var(--color-text-secondary,#4B5563)]"
            >
              {zoomYPercent != null ? `${zoomYPercent}%` : '—'}
            </span>
            <button
              type="button"
              data-testid="vybpad-zoom-y-out"
              aria-label="Zoom melody rows out"
              disabled={onZoomYOut == null}
              onClick={onZoomYOut}
              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-2 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
            >
              −
            </button>
            <button
              type="button"
              data-testid="vybpad-zoom-y-in"
              aria-label="Zoom melody rows in"
              disabled={onZoomYIn == null}
              onClick={onZoomYIn}
              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-2 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
            >
              +
            </button>
            <button
              type="button"
              data-testid="vybpad-zoom-y-reset"
              aria-label="Reset melody row zoom to 1:1 (100%)"
              disabled={onZoomYReset == null}
              onClick={onZoomYReset}
              className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-2 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
            >
              1:1
            </button>
          </div>
        ) : null}

        {loopContent ? (
          <>
            <div
              className="hidden h-6 w-px shrink-0 bg-[var(--color-border,#E5E7EB)] sm:block"
              aria-hidden
            />
            {loopContent}
          </>
        ) : null}

        {trailingContent ? (
          <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Trailing transport controls">
            {trailingContent}
          </div>
        ) : null}

        <div className="hidden h-6 w-px shrink-0 bg-[var(--color-border,#E5E7EB)] sm:block" aria-hidden />
        <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Deferred shell features">
          <span id="vybpad-mvp-deferred-hint" className="sr-only">
            Not in MVP; deferred per ARCHITECTURE roadmap.
          </span>
          {(['Band', 'Lyrics', 'Stable'] as const).map((label) => (
            <button
              key={label}
              type="button"
              disabled
              aria-describedby="vybpad-mvp-deferred-hint"
              title="Not in MVP — deferred per ARCHITECTURE roadmap."
              className="inline-flex min-h-8 min-w-8 cursor-not-allowed items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 text-sm font-medium text-[var(--color-text-muted,#9CA3AF)] outline-none"
            >
              {label}
            </button>
          ))}
        </div>

        {initStatus === 'initializing' && (
          <div
            role="status"
            className="flex items-center gap-2 text-sm text-[var(--color-text-secondary,#4B5563)]"
            aria-live="polite"
          >
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary,#4F46E5)] border-t-transparent"
              aria-hidden="true"
            />
            <span>Loading piano samples…</span>
          </div>
        )}

        {initStatus === 'ready' && (
          <p className="sr-only" role="status" aria-live="polite">
            Playback ready. Piano samples loaded.
          </p>
        )}

        {initErrorCode ? (
          <p
            role="alert"
            className="max-w-md text-sm text-[var(--color-destructive,#DC2626)]"
          >
            {getPlaybackInitErrorMessage(initErrorCode)}
          </p>
        ) : null}

        {endContent ? (
          <div
            data-testid="vybpad-midi-export-cluster"
            className="ml-auto flex min-w-0 shrink-0 flex-nowrap items-center gap-2 overflow-x-auto"
            role="group"
            aria-label="MIDI export"
          >
            {endContent}
          </div>
        ) : null}
      </div>
    </div>
  );
}
