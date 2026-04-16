/**
 * UI-W8 remediation — `TempoMeterAtMeasureDialog` must use the same target measure as
 * transport key/meter readout (`keyScaleTargetMeasureIndex`), not `selectedMeasures?.[0]` only.
 */
import { describe, expect, it } from 'vitest';

import { keyScaleTargetMeasureIndex } from '@/app/keyScaleTargetMeasureIndex';

describe('keyScaleTargetMeasureIndex — UI-W8 tempo/meter + transport alignment', () => {
  it('uses measure-bar range start (min of range) when a range is selected', () => {
    expect(keyScaleTargetMeasureIndex([3, 7], { type: 'chord', measureIndex: 2, eventIds: [] })).toBe(3);
  });

  it('uses canvas selection measure when measure-bar selection is null', () => {
    expect(
      keyScaleTargetMeasureIndex(null, {
        type: 'note',
        measureIndex: 5,
        eventIds: ['a'],
      }),
    ).toBe(5);
  });

  it('defaults to 0 when neither measure bar nor canvas selection applies', () => {
    expect(keyScaleTargetMeasureIndex(null, null)).toBe(0);
  });
});
