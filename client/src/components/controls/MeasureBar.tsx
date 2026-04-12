/**
 * Bottom measure strip (TASK-2.10). Contract: INTERFACES.md `MeasureBarProps`.
 * Shift+range uses the last plain-clicked index as anchor so tests (and parents) work without a re-render between clicks.
 * Selection chrome: UX §6 — fill rgba(59,130,246,0.2), outline #2563EB.
 */

import { useEffect, useRef, type MouseEvent } from 'react';

export interface MeasureBarProps {
  measureCount: number;
  selectedMeasures: [number, number] | null;
  measuresPerLine: number;
  onSelectMeasure: (index: number) => void;
  onSelectRange: (start: number, end: number) => void;
  onAddMeasures: (count: number) => void;
  onDeleteMeasures: (start: number, end: number) => void;
}

function chunkMeasureIndices(measureCount: number, perLine: number): number[][] {
  const rows: number[][] = [];
  for (let i = 0; i < measureCount; i += perLine) {
    const row: number[] = [];
    const limit = Math.min(i + perLine, measureCount);
    for (let j = i; j < limit; j++) row.push(j);
    rows.push(row);
  }
  return rows;
}

const secondaryButtonClass =
  'inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-primary,#4F46E5)] transition-colors hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2';

const destructiveOutlineButtonClass =
  'inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-destructive,#DC2626)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-destructive,#DC2626)] transition-colors hover:bg-[#FEF2F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2';

const disabledButtonClass =
  'pointer-events-none cursor-not-allowed border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface-muted,#F9FAFB)] text-[var(--color-text-muted,#9CA3AF)] hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-0';

export function MeasureBar({
  measureCount,
  selectedMeasures,
  measuresPerLine,
  onSelectMeasure,
  onSelectRange,
  onAddMeasures,
  onDeleteMeasures,
}: MeasureBarProps) {
  const lastClickedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (selectedMeasures) {
      lastClickedIndexRef.current = selectedMeasures[0];
    }
  }, [selectedMeasures]);

  const rows = chunkMeasureIndices(measureCount, measuresPerLine);

  const coversAllMeasures =
    selectedMeasures !== null &&
    selectedMeasures[0] === 0 &&
    selectedMeasures[1] === measureCount - 1;
  const deleteDisabled =
    selectedMeasures === null || measureCount <= 1 || coversAllMeasures;

  const isInSelection = (index: number) => {
    if (!selectedMeasures) return false;
    return index >= selectedMeasures[0] && index <= selectedMeasures[1];
  };

  const handleCellClick = (index: number, e: MouseEvent) => {
    if (e.shiftKey) {
      const anchor = lastClickedIndexRef.current ?? selectedMeasures?.[0] ?? index;
      const start = Math.min(anchor, index);
      const end = Math.max(anchor, index);
      onSelectRange(start, end);
      return;
    }
    lastClickedIndexRef.current = index;
    onSelectMeasure(index);
  };

  return (
    <footer
      className="flex h-[56px] shrink-0 items-stretch border-t border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)]"
      role="region"
      aria-label="Measures"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1 overflow-x-auto px-2 py-1">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex min-w-0 flex-nowrap gap-0.5">
            {row.map((measureIndex) => {
              const display = measureIndex + 1;
              const selected = isInSelection(measureIndex);
              return (
                <button
                  key={measureIndex}
                  type="button"
                  data-measure-index={measureIndex}
                  aria-label={`Measure ${display}`}
                  aria-pressed={selected ? 'true' : 'false'}
                  aria-selected={selected ? 'true' : 'false'}
                  onClick={(e) => handleCellClick(measureIndex, e)}
                  className={[
                    'min-h-[44px] min-w-[44px] shrink-0 rounded-md text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2',
                    selected
                      ? 'selected border-[#2563EB] bg-[rgba(59,130,246,0.2)] text-[var(--color-text-primary,#111827)] ring-1 ring-[#2563EB]/80'
                      : 'border-transparent text-[var(--color-text-secondary,#4B5563)] hover:bg-[var(--color-surface-muted,#F9FAFB)]',
                  ].join(' ')}
                >
                  {display}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-l border-[var(--color-border,#E5E7EB)] px-2">
        <button type="button" className={secondaryButtonClass} onClick={() => onAddMeasures(1)}>
          Add
        </button>
        <button
          type="button"
          disabled={deleteDisabled}
          className={[destructiveOutlineButtonClass, deleteDisabled ? disabledButtonClass : ''].join(' ')}
          onClick={() => {
            if (!selectedMeasures || deleteDisabled) return;
            onDeleteMeasures(selectedMeasures[0], selectedMeasures[1]);
          }}
        >
          Delete
        </button>
      </div>
    </footer>
  );
}
