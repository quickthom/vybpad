import type { SongData } from '@vybpad/shared';
import { TICKS_PER_QUARTER } from '@vybpad/shared';

import { getMeasureStartTicks } from '../renderer/tickUtils';

/**
 * INTERFACES `TransportControls` — `currentBeat` display as `measure:beat` (1-based measure, beat within bar).
 */
export function formatTransportBeat(song: SongData, absoluteTick: number): string {
  const starts = getMeasureStartTicks(song);
  if (starts.length < 2) {
    return '1:1';
  }

  let measureIndex = 0;
  for (let i = starts.length - 2; i >= 0; i--) {
    if (absoluteTick >= starts[i]) {
      measureIndex = i;
      break;
    }
  }

  const tickInMeasure = Math.max(0, absoluteTick - starts[measureIndex]);
  const beat = Math.floor(tickInMeasure / TICKS_PER_QUARTER) + 1;
  return `${measureIndex + 1}:${beat}`;
}
