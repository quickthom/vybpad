import type { ReactElement } from 'react';

import type { ChordEvent } from '@vybpad/shared';

import { ChordProperties } from './ChordProperties';
import { MelodyProperties } from './MelodyProperties';

export interface EditorPropertiesPanelProps {
  selectionType: 'chord' | 'note' | 'range' | null;
  chordContext: { measureIndex: number; chord: ChordEvent } | null;
  onChordUpdate: (measureIndex: number, chordId: string, changes: Partial<ChordEvent>) => void;
}

/**
 * UI-W4 — right-rail properties: melody tools always available; chord inspector when a chord is selected.
 */
export function EditorPropertiesPanel({
  selectionType,
  chordContext,
  onChordUpdate,
}: EditorPropertiesPanelProps): ReactElement {
  const showChord = selectionType === 'chord' && chordContext != null;

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
          onUpdate={(changes) => onChordUpdate(chordContext.measureIndex, chordContext.chord.id, changes)}
        />
      ) : (
        <MelodyProperties />
      )}
    </section>
  );
}
