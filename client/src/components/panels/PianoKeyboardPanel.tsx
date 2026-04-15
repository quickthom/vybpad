import type { NoteName, ScaleType } from '@vybpad/shared';
import { useMemo } from 'react';

import { ionianTonicPcForMajorCentric } from '../../engine/renderer/chordBlocks';
import { pat010MajorCentricHex } from '../../engine/renderer/colorMaps';
import { blendDegreeFillWithWhite } from '../../engine/renderer/noteBlocks';

/** PAT-004 / INTERFACES: chromatic pitch classes that use black keys in 12-ET. */
const BLACK_PC = new Set([1, 3, 6, 8, 10]);

function isBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return BLACK_PC.has(pc);
}

function highlightFillForMidi(midi: number, homeKey: NoteName, scale: ScaleType): string {
  const pc = ((midi % 12) + 12) % 12;
  const ionianTonic = ionianTonicPcForMajorCentric(homeKey, scale);
  const baseHex = pat010MajorCentricHex(pc - ionianTonic);
  return blendDegreeFillWithWhite(baseHex);
}

export interface PianoKeyboardPanelProps {
  homeKey: NoteName;
  scale: ScaleType;
  /** Absolute MIDI note numbers (0–127) to highlight (e.g. chord voicing + active melody tones). */
  highlightedMidi: readonly number[];
  /** Visible keyboard range; defaults center ~three octaves on middle C when omitted. */
  lowMidi?: number;
  highMidi?: number;
}

const DEFAULT_LOW = 48;
const DEFAULT_HIGH = 84;

function isValidMidi(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 127;
}

/**
 * Read-only piano keyboard strip (TASK-7.7). Web MIDI input is out of scope — visualization only.
 */
export function PianoKeyboardPanel({
  homeKey,
  scale,
  highlightedMidi,
  lowMidi = DEFAULT_LOW,
  highMidi = DEFAULT_HIGH,
}: PianoKeyboardPanelProps) {
  const lo = Math.max(0, Math.min(127, Math.min(lowMidi, highMidi)));
  const hi = Math.max(0, Math.min(127, Math.max(lowMidi, highMidi)));

  const highlightSet = useMemo(() => {
    const s = new Set<number>();
    for (const m of highlightedMidi) {
      if (!isValidMidi(m)) {
        continue;
      }
      s.add(m);
    }
    return s;
  }, [highlightedMidi]);

  const whiteMidis = useMemo(() => {
    const w: number[] = [];
    for (let m = lo; m <= hi; m += 1) {
      if (!isBlackKey(m)) {
        w.push(m);
      }
    }
    return w;
  }, [lo, hi]);

  const blackMidis = useMemo(() => {
    const b: number[] = [];
    for (let m = lo; m <= hi; m += 1) {
      if (isBlackKey(m)) {
        b.push(m);
      }
    }
    return b;
  }, [lo, hi]);

  const whiteCount = whiteMidis.length;

  /** Horizontal center (% from left) for black key `midi`, for `left` + `translateX(-50%)`. */
  function blackKeyCenterPercent(midi: number): number | null {
    const below = midi - 1;
    if (below < lo || isBlackKey(below)) {
      return null;
    }
    const idxBelow = whiteMidis.indexOf(below);
    if (idxBelow < 0 || whiteCount === 0) {
      return null;
    }
    return ((idxBelow + 0.65) / whiteCount) * 100;
  }

  return (
    <section
      id="vybpad-piano-keyboard-region"
      role="region"
      aria-label="Piano keyboard"
      data-readonly="true"
      className="flex flex-col gap-2 px-4 pb-4 pt-2"
    >
      <h3
        id="vybpad-piano-panel-title"
        className="text-base font-semibold leading-snug text-[var(--color-text-primary,#111827)]"
      >
        Piano
      </h3>
      <div className="relative min-h-[112px] w-full select-none overflow-x-auto">
        <div
          className="relative mx-auto h-[100px]"
          style={{ width: `${Math.max(whiteCount * 20, 240)}px`, maxWidth: '100%' }}
        >
          {/* White keys */}
          <div className="absolute inset-0 flex flex-row">
            {whiteMidis.map((m) => {
              const on = highlightSet.has(m);
              const fill = on ? highlightFillForMidi(m, homeKey, scale) : undefined;
              return (
                <div
                  key={m}
                  data-midi={m}
                  data-highlighted={on ? 'true' : 'false'}
                  tabIndex={-1}
                  className={
                    on
                      ? 'box-border flex-1 border border-[var(--color-border-strong,#D1D5DB)] first:rounded-l-md last:rounded-r-md'
                      : 'box-border flex-1 border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] first:rounded-l-md last:rounded-r-md'
                  }
                  style={on ? { backgroundColor: fill } : undefined}
                />
              );
            })}
          </div>
          {/* Black keys (positioned between whites) */}
          {blackMidis.map((m) => {
            const pct = blackKeyCenterPercent(m);
            if (pct === null) {
              return null;
            }
            const on = highlightSet.has(m);
            const fill = on ? highlightFillForMidi(m, homeKey, scale) : 'var(--color-text-primary, #111827)';
            return (
              <div
                key={m}
                data-midi={m}
                data-highlighted={on ? 'true' : 'false'}
                tabIndex={-1}
                className="pointer-events-none absolute top-0 z-10 h-[64px] -translate-x-1/2 rounded-b-md border border-[var(--color-border-strong,#D1D5DB)] shadow-sm"
                style={{
                  left: `${pct}%`,
                  width: whiteCount > 0 ? `${(60 / whiteCount).toFixed(4)}%` : '4%',
                  backgroundColor: on ? fill : 'var(--color-text-primary, #111827)',
                }}
              />
            );
          })}
        </div>
      </div>
      <p className="text-[12px] leading-snug text-[var(--color-text-muted,#9CA3AF)]">
        Read-only preview; keys light up with notes at the playhead. No MIDI input.
      </p>
    </section>
  );
}
