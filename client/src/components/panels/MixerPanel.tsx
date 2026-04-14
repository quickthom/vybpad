import type { BandConfig, Track, TrackRole } from '@vybpad/shared';

/** INTERFACES.md `MixerPanelProps`. */
export interface MixerPanelProps {
  bandConfig: BandConfig;
  onTrackChange: (role: TrackRole, changes: Partial<Track>) => void;
}

const ROLE_LABEL: Record<TrackRole, string> = {
  melody1: 'Melody 1',
  melody2: 'Melody 2',
  melody3: 'Melody 3',
  melody4: 'Melody 4',
  harmony: 'Harmony',
  bass: 'Bass',
  drums: 'Drums',
};

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function TrackRow({
  track,
  onTrackChange,
}: {
  track: Track;
  onTrackChange: (role: TrackRole, changes: Partial<Track>) => void;
}) {
  const pct = Math.round(clampVolume(track.volume) * 100);
  const fillPct = clampVolume(track.volume) * 100;

  return (
    <div className="group flex min-h-11 items-center gap-3">
      <div className="w-[72px] shrink-0 text-xs font-medium text-[var(--color-text-primary,#111827)]">
        {ROLE_LABEL[track.role]}
      </div>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          aria-label={`${ROLE_LABEL[track.role]} volume`}
          className="vybpad-mixer-range h-[6px] w-full cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--color-primary,#4F46E5) 0%, var(--color-primary,#4F46E5) ${fillPct}%, #E5E7EB ${fillPct}%, #E5E7EB 100%)`,
          }}
          onChange={(e) => {
            const next = clampVolume(Number(e.target.value) / 100);
            onTrackChange(track.role, { volume: next });
          }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs text-[var(--color-text-secondary,#4B5563)] tabular-nums">
        {pct}%
      </span>
      <button
        type="button"
        aria-label={track.mute ? `Unmute ${ROLE_LABEL[track.role]}` : `Mute ${ROLE_LABEL[track.role]}`}
        aria-pressed={track.mute}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] text-xs font-semibold text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 aria-pressed:bg-[var(--color-surface-muted,#F9FAFB)]"
        onClick={() => onTrackChange(track.role, { mute: !track.mute })}
      >
        M
      </button>
    </div>
  );
}

/**
 * Per-track volume and mute — INTERFACES `MixerPanelProps`, UX §3 width (container), §5.5 sliders.
 */
export function MixerPanel({ bandConfig, onTrackChange }: MixerPanelProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col px-4 py-3">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary,#111827)]">Mixer</h3>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {bandConfig.tracks.map((t) => (
          <TrackRow key={t.role} track={t} onTrackChange={onTrackChange} />
        ))}
      </div>
    </div>
  );
}
