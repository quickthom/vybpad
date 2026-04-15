import type { NoteName, ScaleType } from '@vybpad/shared';
import { useEffect, useRef, useState } from 'react';

import { applyKeyChange, applyScaleChange } from '@/engine/theory';
import { getKeyAtMeasure, getScaleAtMeasure } from '@/engine/renderer/tickUtils';
import { useSongStore } from '@/store/songStore';

import { KeyScaleSelector } from './KeyScaleSelector';

export type KeyScaleChangeDialogProps = {
  open: boolean;
  /** Called when the dialog closes for any reason (Cancel, Escape, backdrop). */
  onClose: () => void;
  /** Measure index at whose start key/scale apply (0-based). */
  measureIndex: number;
};

/**
 * Modal to set key and/or scale at the start of a measure (`Measure.changes`).
 * UX §5.6 / §9 — native `<dialog>` for focus trap + Escape; backdrop click closes.
 */
export function KeyScaleChangeDialog({ open, onClose, measureIndex }: KeyScaleChangeDialogProps) {
  const setMeasureChanges = useSongStore((s) => s.setMeasureChanges);
  const updateMetadata = useSongStore((s) => s.updateMetadata);

  const [{ key, scale }, setKeyScale] = useState<{ key: NoteName; scale: ScaleType }>({
    key: 'C',
    scale: 'major',
  });

  const dialogRef = useRef<HTMLDialogElement>(null);

  // Snapshot effective key/scale when the dialog opens (avoid resetting while typing if song changes).
  useEffect(() => {
    if (!open) return;
    const song = useSongStore.getState().song;
    const mi = Math.max(0, Math.min(measureIndex, song.measures.length - 1));
    setKeyScale({
      key: getKeyAtMeasure(song, mi),
      scale: getScaleAtMeasure(song, mi),
    });
  }, [open, measureIndex]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  function handleApply(): void {
    const song = useSongStore.getState().song;
    const mi = Math.max(0, Math.min(measureIndex, song.measures.length - 1));
    setMeasureChanges(mi, { key, scale });
    // Whole-song default: keep metadata aligned when the change is at the first measure (INTERFACES SongMetadata).
    if (mi === 0) {
      updateMetadata({ key, scale });
    }
    onClose();
  }

  const displayMeasure = measureIndex + 1;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="vybpad-key-scale-dialog-title"
      aria-modal="true"
      className="min-w-[400px] max-w-[min(560px,calc(100vw-32px))] max-h-[min(560px,80vh)] rounded-xl border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] p-6 shadow-lg backdrop:bg-[rgba(17,24,39,0.5)]"
      onClose={() => onClose()}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
    >
      <div className="flex max-h-[min(512px,calc(80vh-48px))] flex-col gap-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="vybpad-key-scale-dialog-title" className="text-xl font-semibold text-[var(--color-text-primary,#111827)]">
            Key and scale
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--color-text-secondary,#4B5563)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-secondary,#4B5563)]">
          Applies at the start of measure {displayMeasure}. Later measures inherit until another change.
        </p>

        <KeyScaleSelector
          currentKey={key}
          currentScale={scale}
          onKeyChange={(nextKey, keyTp) =>
            setKeyScale((prev) => applyKeyChange(prev.key, prev.scale, nextKey, keyTp))
          }
          onScaleChange={(nextScale, scaleTp) =>
            setKeyScale((prev) => applyScaleChange(prev.key, prev.scale, nextScale, scaleTp))
          }
        />

        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-4 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none transition hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Apply
          </button>
        </div>
      </div>
    </dialog>
  );
}
