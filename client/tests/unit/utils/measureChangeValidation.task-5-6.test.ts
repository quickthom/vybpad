import { describe, expect, it } from 'vitest';

import {
  isValidMeter,
  isValidTempo,
  mergeMeasureChanges,
} from '../../../src/utils/measureChangeValidation';

describe('TASK-5.6 measureChangeValidation', () => {
  it('accepts tempo integers in 20–300', () => {
    expect(isValidTempo(20)).toBe(true);
    expect(isValidTempo(300)).toBe(true);
    expect(isValidTempo(90)).toBe(true);
  });

  it('rejects non-integer or out-of-range tempo', () => {
    expect(isValidTempo(19)).toBe(false);
    expect(isValidTempo(301)).toBe(false);
    expect(isValidTempo(90.5)).toBe(false);
  });

  it('accepts common meters', () => {
    expect(isValidMeter({ numerator: 4, denominator: 4 })).toBe(true);
    expect(isValidMeter({ numerator: 6, denominator: 8 })).toBe(true);
  });

  it('rejects invalid meters', () => {
    expect(isValidMeter({ numerator: 0, denominator: 4 })).toBe(false);
    expect(isValidMeter({ numerator: 4, denominator: 3 })).toBe(false);
  });

  it('mergeMeasureChanges drops invalid fields but keeps prior valid tempo', () => {
    const merged = mergeMeasureChanges({ tempo: 100 }, { tempo: 400 });
    expect(merged.tempo).toBe(100);
  });

  it('mergeMeasureChanges applies valid tempo', () => {
    const merged = mergeMeasureChanges(undefined, { tempo: 200 });
    expect(merged.tempo).toBe(200);
  });
});
