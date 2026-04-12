/**
 * Bottom measure strip (TASK-2.10). INTERFACES.md `MeasureBarProps`.
 * Shift+range uses anchorRef (last plain click, synced from props). Drag: pointerdown → pointerenter cells → pointerup → onSelectRange.
 * Selection chrome: UX §6 — fill rgba(59,130,246,0.2), border #2563EB.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

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
  const anchorRef = useRef(0);
  const dragStartRef = useRef<number | null>(null);
  const dragCurrentRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const [dragRange, setDragRange] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (selectedMeasures) {
      anchorRef.current = selectedMeasures[0];
    }
  }, [selectedMeasures]);

  const effectiveRange = dragRange ?? selectedMeasures;

  const isCellHighlighted = useCallback(
    (index: number) => {
      if (!effectiveRange) return false;
      const [a, b] = effectiveRange;
      return index >= a && index <= b;
    },
    [effectiveRange],
  );

  const rows = chunkMeasureIndices(measureCount, measuresPerLine);

  const deleteDisabled =
    selectedMeasures === null ||
    measureCount - (selectedMeasures[1] - selectedMeasures[0] + 1) < 1;

  const handlePointerDown = (index: number, e: ReactPointerEvent<HTMLButtonElement>) => {
    dragStartRef.current = index;
    dragCurrentRef.current = index;
    const up = (upEvent: globalThis.PointerEvent) => {
      if (upEvent.pointerId !== e.pointerId) return;
      window.removeEventListener('pointerup', up);
      const start = dragStartRef.current;
      const end = dragCurrentRef.current;
      dragStartRef.current = null;
      dragCurrentRef.current = null;
      setDragRange(null);
      if (start === null || end === null) return;
      if (start !== end) {
        suppressClickRef.current = true;
        const lo = Math.min(start, end);
        const hi = Math.max(start, end);
        onSelectRange(lo, hi);
        anchorRef.current = lo;
      }
    };
    window.addEventListener('pointerup', up);
  };

  const handlePointerEnter = (index: number) => {
    if (dragStartRef.current === null) return;
    dragCurrentRef.current = index;
    const start = dragStartRef.current;
    if (start !== index) {
      setDragRange([Math.min(start, index), Math.max(start, index)]);
    } else {
      setDragRange(null);
    }
  };

  const handleCellClick = (index: number, e: MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    e.preventDefault();
    if (e.shiftKey) {
      const anchor = anchorRef.current;
      const lo = Math.min(anchor, index);
      const hi = Math.max(anchor, index);
      onSelectRange(lo, hi);
      anchorRef.current = lo;
    } else {
      onSelectMeasure(index);
      anchorRef.current = index;
    }
  };

  return (
    <footer
      className="flex h-[56px] min-h-[56px] shrink-0 items-stretch border-t border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)]"
      role="region"
      aria-label="Measures"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1 overflow-x-auto px-2 py-1">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex flex-wrap gap-1">
            {row.map((measureIndex) => {
              const display = measureIndex + 1;
              const on = isCellHighlighted(measureIndex);
              return (
                <button
                  key={measureIndex}
                  type="button"
                  data-measure-index={measureIndex}
                  onPointerDown={(e) => handlePointerDown(measureIndex, e)}
                  onPointerEnter={() => handlePointerEnter(measureIndex)}
                  onClick={(e) => handleCellClick(measureIndex, e)}
                  className={[
                    'min-h-11 min-w-11 shrink-0 rounded-md border px-2 text-center text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2',
                    on
                      ? 'border-[#2563EB] bg-[rgba(59,130,246,0.2)] text-[var(--color-text-primary,#111827)]'
                      : 'border-transparent text-[var(--color-text-secondary,#4B5563)] hover:bg-[var(--color-surface-muted,#F9FAFB)]',
                  ].join(' ')}
                  aria-pressed={on ? 'true' : 'false'}
                  aria-label={`Measure ${display}`}
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
