import type { Selection } from '@vybpad/shared';

/**
 * Measure index for key/scale/tempo-meter dialogs and transport key+meter readout (UI-W8).
 * Prefer measure-bar range when set; else canvas selection’s measure; else 0.
 */
export function keyScaleTargetMeasureIndex(
  selectedMeasures: [number, number] | null,
  selection: Selection | null,
): number {
  if (selectedMeasures) {
    return Math.min(selectedMeasures[0], selectedMeasures[1]);
  }
  if (selection?.measureIndex != null) {
    return selection.measureIndex;
  }
  return 0;
}
