import { useCallback, useState } from 'react';

import type { NoteName, ScaleType } from '@vybpad/shared';

/** INTERFACES.md — KeyScaleSelector */
export interface KeyScaleSelectorProps {
  currentKey: NoteName;
  currentScale: ScaleType;
  onKeyChange: (key: NoteName, transposition: 'parallel' | 'relative') => void;
  onScaleChange: (scale: ScaleType, transposition: 'parallel' | 'relative') => void;
}

const NOTE_NAMES: NoteName[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

const SCALE_TYPES: ScaleType[] = [
  'major',
  'minor',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'locrian',
  'harmonicMinor',
  'phrygianDominant',
];

function formatScaleLabel(s: ScaleType): string {
  switch (s) {
    case 'harmonicMinor':
      return 'Harmonic minor';
    case 'phrygianDominant':
      return 'Phrygian dominant';
    default:
      return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

/**
 * Key + scale pickers with separate parallel / relative transposition modes per INTERFACES.
 * Callbacks fire when the user commits a new key or scale from the corresponding select.
 */
export function KeyScaleSelector({
  currentKey,
  currentScale,
  onKeyChange,
  onScaleChange,
}: KeyScaleSelectorProps) {
  const [keyTransposition, setKeyTransposition] = useState<'parallel' | 'relative'>('parallel');
  const [scaleTransposition, setScaleTransposition] = useState<'parallel' | 'relative'>('parallel');

  const handleKeySelect = useCallback(
    (next: NoteName) => {
      onKeyChange(next, keyTransposition);
    },
    [keyTransposition, onKeyChange],
  );

  const handleScaleSelect = useCallback(
    (next: ScaleType) => {
      onScaleChange(next, scaleTransposition);
    },
    [onScaleChange, scaleTransposition],
  );

  const selectCls =
    'h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none transition hover:border-[var(--color-border-strong,#D1D5DB)] focus-visible:border-[var(--color-primary,#4F46E5)] focus-visible:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="vybpad-key-scale-key" className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]">
          Key
        </label>
        <select
          id="vybpad-key-scale-key"
          value={currentKey}
          onChange={(e) => handleKeySelect(e.target.value as NoteName)}
          className={selectCls}
        >
          {NOTE_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 text-[12px] text-[var(--color-text-secondary,#4B5563)]">Key transposition</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-primary,#111827)]">
              <input
                type="radio"
                name="vybpad-key-tp"
                checked={keyTransposition === 'parallel'}
                onChange={() => setKeyTransposition('parallel')}
                className="size-[18px] accent-[var(--color-primary,#4F46E5)]"
              />
              Parallel
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-primary,#111827)]">
              <input
                type="radio"
                name="vybpad-key-tp"
                checked={keyTransposition === 'relative'}
                onChange={() => setKeyTransposition('relative')}
                className="size-[18px] accent-[var(--color-primary,#4F46E5)]"
              />
              Relative
            </label>
          </div>
        </fieldset>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="vybpad-key-scale-scale"
          className="text-[13px] font-medium text-[var(--color-text-primary,#111827)]"
        >
          Scale / mode
        </label>
        <select
          id="vybpad-key-scale-scale"
          value={currentScale}
          onChange={(e) => handleScaleSelect(e.target.value as ScaleType)}
          className={selectCls}
        >
          {SCALE_TYPES.map((s) => (
            <option key={s} value={s}>
              {formatScaleLabel(s)}
            </option>
          ))}
        </select>
        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 text-[12px] text-[var(--color-text-secondary,#4B5563)]">Scale transposition</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-primary,#111827)]">
              <input
                type="radio"
                name="vybpad-scale-tp"
                checked={scaleTransposition === 'parallel'}
                onChange={() => setScaleTransposition('parallel')}
                className="size-[18px] accent-[var(--color-primary,#4F46E5)]"
              />
              Parallel
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-primary,#111827)]">
              <input
                type="radio"
                name="vybpad-scale-tp"
                checked={scaleTransposition === 'relative'}
                onChange={() => setScaleTransposition('relative')}
                className="size-[18px] accent-[var(--color-primary,#4F46E5)]"
              />
              Relative
            </label>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
