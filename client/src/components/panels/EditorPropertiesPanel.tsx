import type { ReactElement } from 'react';

import type { ChordEvent, NoteName, ScaleType } from '@vybpad/shared';

import { ChordProperties } from './ChordProperties';
import { MelodyProperties } from './MelodyProperties';

export interface EditorPropertiesPanelProps {
  selectionType: 'chord' | 'note' | 'range' | null;
  chordContext: { measureIndex: number; chord: ChordEvent } | null;
  /** Key/scale at the selected chord’s measure (Roman + chord name in inspector). */
  chordKey?: NoteName;
  chordTheoryScale?: ScaleType;
  onChordUpdate: (measureIndex: number, chordId: string, changes: Partial<ChordEvent>) => void;
  onSecondaryCycle?: () => void;
  onSecondaryClear?: () => void;
}

/**
 * UI-W4 — right-rail properties: melody tools always available; chord inspector when a chord is selected.
 */
export function EditorPropertiesPanel({
  selectionType,
  chordContext,
  chordKey,
  chordTheoryScale,
  onChordUpdate,
  onSecondaryCycle,
  onSecondaryClear,
}: EditorPropertiesPanelProps): ReactElement {
  const showChord =
    selectionType === 'chord' && chordContext != null && chordKey != null && chordTheoryScale != null;

  return (
    <section
      data-testid="properties-region"
      role="region"
      aria-label="Editor properties"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-[var(--color-surface,#FFFFFF)]"
    >
      {showChord ? (
        <ChordProperties
          chord={chordContext.chord}
          currentKey={chordKey}
          theoryScale={chordTheoryScale}
          onUpdate={(changes) => onChordUpdate(chordContext.measureIndex, chordContext.chord.id, changes)}
          onSecondaryCycle={onSecondaryCycle}
          onSecondaryClear={onSecondaryClear}
        />
      ) : (
        <MelodyProperties />
      )}
    </section>
  );
}
