import type { ReactNode } from 'react';

import { getPlaybackInitErrorMessage } from '../../engine/audio';
import type { PlaybackInitErrorCode, PlaybackInitStatus } from '../../store/playbackStore';

/** INTERFACES.md — `TransportControls` / `TransportControlsProps` (TASK-4.1 readiness). */
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
  /** Loop region controls (UI-W6 — folded into transport row; RA-11). */
  loopContent?: ReactNode;
  /** Optional trailing slot (e.g. MIDI export / drag-to-desktop affordance); omit when unused. */
  endContent?: ReactNode;
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
  loopContent,
  endContent,
}: TransportControlsProps) {
  const playDisabled = initStatus === 'initializing';
  /** Pause / stop / rewind require a running engine (INTERFACES transport actions). */
  const transportLocked = initStatus !== 'ready';

  return (
    <div
      data-testid="vybpad-transport-toolbar"
      role="toolbar"
      aria-label="Transport"
      aria-busy={initStatus === 'initializing' ? true : undefined}
      data-audio-ready={initStatus === 'ready' ? 'true' : 'false'}
      className="flex min-h-12 min-w-0 flex-wrap items-center gap-2 border-b border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-4 lg:flex-nowrap lg:overflow-x-auto"
    >
      <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Playback">
        {isPlaying ? (
          <button
            type="button"
            data-testid="vybpad-transport-pause"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-3 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
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
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-3 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            aria-label={initStatus === 'ready' ? 'Play' : 'Start audio and play'}
            disabled={playDisabled}
            onClick={onPlay}
          >
            {initStatus === 'initializing' ? 'Starting…' : 'Play'}
          </button>
        )}
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Stop playback"
          disabled={transportLocked}
          onClick={onStop}
        >
          Stop
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Rewind to start"
          disabled={transportLocked}
          onClick={onRewind}
        >
          Rewind
        </button>
      </div>

      <div
        data-testid="vybpad-transport-current-beat"
        className="flex min-h-11 min-w-[120px] shrink-0 items-center text-sm tabular-nums text-[var(--color-text-primary,#111827)]"
        aria-live="polite"
      >
        <span className="sr-only">Current position</span>
        <span aria-hidden="true">{currentBeat}</span>
      </div>

      <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--color-text-secondary,#4B5563)]">
        <span id="transport-tempo-label">Tempo</span>
        <input
          id="transport-tempo-input"
          type="number"
          min={20}
          max={300}
          value={tempo}
          onChange={(e) => onTempoChange(Number(e.target.value))}
          className="h-11 w-20 rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-2 text-center text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none focus:border-[var(--color-primary,#4F46E5)] focus:ring-1 focus:ring-[var(--color-primary,#4F46E5)] disabled:opacity-50"
          aria-labelledby="transport-tempo-label"
        />
        <span className="text-[var(--color-text-muted,#9CA3AF)]" aria-hidden="true">
          BPM
        </span>
      </label>

      {loopContent ? (
        <>
          <div
            className="hidden h-6 w-px shrink-0 bg-[var(--color-border,#E5E7EB)] sm:block"
            aria-hidden
          />
          {loopContent}
        </>
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
            className="inline-flex min-h-11 min-w-11 cursor-not-allowed items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 text-sm font-medium text-[var(--color-text-muted,#9CA3AF)] outline-none"
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
  );
}
