import { useEffect, useId, useState } from 'react';

import { usePlaybackStore } from '../../store/playbackStore';

/**
 * Transport-adjacent loop region controls (TASK-4.8). Integer ticks per PAT-004; §5.8 chrome.
 */
export function LoopBar() {
  const groupId = useId();
  const isLooping = usePlaybackStore((s) => s.isLooping);
  const loopStart = usePlaybackStore((s) => s.loopStart);
  const loopEnd = usePlaybackStore((s) => s.loopEnd);
  const setLoop = usePlaybackStore((s) => s.setLoop);
  const clearLoop = usePlaybackStore((s) => s.clearLoop);

  const [startStr, setStartStr] = useState(() => String(loopStart));
  const [endStr, setEndStr] = useState(() => String(loopEnd));

  useEffect(() => {
    setStartStr(String(loopStart));
    setEndStr(String(loopEnd));
  }, [loopStart, loopEnd]);

  function handleApply(): void {
    const s = Number(startStr);
    const e = Number(endStr);
    setLoop(s, e);
  }

  return (
    <div
      className="flex min-h-11 min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap lg:overflow-x-auto"
      role="group"
      aria-labelledby={`${groupId}-label`}
    >
      <span id={`${groupId}-label`} className="flex shrink-0 flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-text-primary,#111827)]">
        Loop
        {isLooping ? (
          <span
            data-testid="vybpad-loop-active-badge"
            className="rounded-full bg-[var(--color-primary,#4F46E5)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-on-primary,#FFFFFF)]"
          >
            Active
          </span>
        ) : null}
      </span>
      <div className="mx-2 hidden h-6 w-px bg-[var(--color-border,#E5E7EB)] sm:block" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex-nowrap">
        <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary,#4B5563)]">
          <span className="whitespace-nowrap">Start (ticks)</span>
          <input
            id={`${groupId}-loop-start`}
            type="number"
            step={1}
            inputMode="numeric"
            className="h-11 w-24 rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-2 text-sm text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-[var(--color-border-strong,#D1D5DB)] focus-visible:border-[var(--color-primary,#4F46E5)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            aria-label="Loop start"
            aria-describedby={`${groupId}-loop-hint`}
            value={startStr}
            onChange={(ev) => setStartStr(ev.target.value)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary,#4B5563)]">
          <span className="whitespace-nowrap">End (ticks)</span>
          <input
            id={`${groupId}-loop-end`}
            type="number"
            step={1}
            inputMode="numeric"
            className="h-11 w-24 rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-2 text-sm text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-[var(--color-border-strong,#D1D5DB)] focus-visible:border-[var(--color-primary,#4F46E5)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            aria-label="Loop end"
            aria-describedby={`${groupId}-loop-hint`}
            value={endStr}
            onChange={(ev) => setEndStr(ev.target.value)}
          />
        </label>
        <span id={`${groupId}-loop-hint`} className="sr-only">
          Loop region in integer ticks (48 ticks per quarter note). End must be greater than start.
        </span>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          onClick={handleApply}
        >
          Set loop
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:opacity-50"
          onClick={() => clearLoop()}
          disabled={!isLooping}
          aria-disabled={!isLooping}
        >
          Clear loop
        </button>
      </div>
      <p id={`${groupId}-live`} className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isLooping
          ? `Loop playback on: ${loopStart} to ${loopEnd} ticks`
          : 'Loop playback off'}
      </p>
    </div>
  );
}
