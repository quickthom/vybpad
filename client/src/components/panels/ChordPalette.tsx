import type { ChordEvent, NoteName, ScaleType } from '@vybpad/shared';

/**
 * TASK-5.1 — Chord palette (left panel). Contract: `INTERFACES.md` § ChordPalette.
 * QA tests committed before interactive UI; Builder replaces this shell with full behavior.
 */
export interface ChordPaletteProps {
  currentKey: NoteName;
  currentScale: ScaleType;
  onChordSelect: (chord: Omit<ChordEvent, 'id' | 'beat' | 'duration'>) => void;
  mode: 'diatonic' | 'borrowed' | 'secondary' | 'search';
}

export function ChordPalette(props: ChordPaletteProps) {
  void props;
  return null;
}
