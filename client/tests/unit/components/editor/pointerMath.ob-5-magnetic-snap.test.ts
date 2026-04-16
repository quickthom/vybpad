/*
 * QA COVERAGE PLAN — OB-5 (operator backlog — magnetic snap)
 *
 * Criterion — Move/resize softly snaps to beat boundaries and major beat fractions (gentle bump):
 *   happy: within threshold → nearest grid step (12-tick coarse grid in 4/4-style measures)
 *   happy: beyond threshold / dead zone → raw beat preserved (no hard lock)
 *   edges: measure boundary grid; dead zone at 42; non-finite input; parity with softMagneticSnapMeasureTick
 *
 * Contract: {@link snapBeatMagnetically}, {@link MAGNETIC_SNAP_THRESHOLD_TICKS},
 * {@link MAGNETIC_SNAP_GRID_STEP_TICKS} in `pointerMath.ts` (EditorCanvas wires later).
 */

import { describe, expect, it } from 'vitest';

import {
  MAGNETIC_SNAP_GRID_STEP_TICKS,
  MAGNETIC_SNAP_THRESHOLD_TICKS,
  snapBeatMagnetically,
  softMagneticSnapMeasureTick,
} from '../../../../src/components/editor/pointerMath';

describe('OB-5 magnetic snap — snapBeatMagnetically', () => {
  describe('happy path', () => {
    it('snaps beat 50 to 48 on a 192-tick measure when distance 2 is within MAGNETIC_SNAP_THRESHOLD_TICKS', () => {
      expect(snapBeatMagnetically(50, 192)).toBe(48);
    });

    it('snaps beat 40 to 36 when the nearest grid line is 4 ticks away (at threshold)', () => {
      expect(snapBeatMagnetically(40, 192)).toBe(36);
    });

    it('snaps beat 71 to 72 when 72 is the nearest multiple of 12 inside the measure', () => {
      expect(snapBeatMagnetically(71, 192)).toBe(72);
    });

    it('leaves beat 0 unchanged', () => {
      expect(snapBeatMagnetically(0, 192)).toBe(0);
    });

    it('exports a positive threshold strictly below half the grid step so a dead zone can exist', () => {
      expect(MAGNETIC_SNAP_GRID_STEP_TICKS).toBeGreaterThan(2 * MAGNETIC_SNAP_THRESHOLD_TICKS);
    });
  });

  describe('error handling / invalid input', () => {
    it('returns a finite integer when beat is NaN and measure length is valid', () => {
      const r = snapBeatMagnetically(Number.NaN, 192);
      expect(Number.isFinite(r)).toBe(true);
      expect(Number.isInteger(r)).toBe(true);
    });

    it('returns a finite integer when measureLengthTicks is non-positive', () => {
      const r = snapBeatMagnetically(48, 0);
      expect(Number.isFinite(r)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('does not snap beat 41 when the nearest grid (36) is 5 ticks away and threshold is 4', () => {
      expect(snapBeatMagnetically(41, 192)).toBe(41);
    });

    it('does not snap beat 42 when equidistant 6 from 36 and 48 (dead zone between grid lines)', () => {
      expect(snapBeatMagnetically(42, 192)).toBe(42);
    });

    it('does not use measureLengthTicks as a snap target when it equals a bar line (192-tick bar ends at tick 191)', () => {
      expect(snapBeatMagnetically(186, 192)).toBe(186);
    });

    it('snaps beat 182 to 180 when 2 ticks from the last in-measure grid line', () => {
      expect(snapBeatMagnetically(182, 192)).toBe(180);
    });
  });
});

describe('OB-5 magnetic snap — softMagneticSnapMeasureTick (EditorCanvas move / resize primitive)', () => {
  it('matches snapBeatMagnetically for a 4/4 measure when min/max span the full bar', () => {
    const len = 192;
    const maxTick = len - 1;
    for (const beat of [0, 40, 41, 42, 50, 71, 182, 186]) {
      expect(softMagneticSnapMeasureTick(beat, 0, maxTick)).toBe(snapBeatMagnetically(beat, len));
    }
  });

  it('snaps the trailing edge tick when resizing, using the same min/max window as clampChordDuration', () => {
    const beat = 48;
    const len = 192;
    const startDuration = 96;
    const deltaTicks = 2;
    const d = Math.round(startDuration + deltaTicks);
    let endTick = beat + d;
    const minEnd = beat + 1;
    endTick = Math.max(minEnd, Math.min(endTick, len));
    const snappedEnd = softMagneticSnapMeasureTick(endTick, minEnd, len);
    expect(snappedEnd - beat).toBe(96);
  });

  it('with threshold 6, snaps beat 42 to 36 because distance 6 is within the snap band (override vs default 4)', () => {
    expect(softMagneticSnapMeasureTick(42, 0, 191, 12, 6)).toBe(36);
  });
});
