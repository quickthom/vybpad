import {
  applyKeyChange,
  applyScaleChange,
  pitchClassSetForKeyScale,
} from '@/engine/theory/keyScaleTranspose';
import { describe, expect, it } from 'vitest';

describe('keyScaleTranspose', () => {
  it('parallel key change keeps scale, moves tonic', () => {
    expect(applyKeyChange('C', 'major', 'G', 'parallel')).toEqual({ key: 'G', scale: 'major' });
  });

  it('relative key change preserves pitch-class set (C major → A on relative → A minor)', () => {
    expect(applyKeyChange('C', 'major', 'A', 'relative')).toEqual({ key: 'A', scale: 'minor' });
  });

  it('relative key change: C major → D → D dorian (same signature)', () => {
    expect(applyKeyChange('C', 'major', 'D', 'relative')).toEqual({ key: 'D', scale: 'dorian' });
  });

  it('relative key change falls back to parallel when new tonic is outside the previous scale', () => {
    expect(applyKeyChange('C', 'major', 'C#', 'relative')).toEqual({ key: 'C#', scale: 'major' });
  });

  it('parallel scale change keeps tonic', () => {
    expect(applyScaleChange('C', 'major', 'minor', 'parallel')).toEqual({ key: 'C', scale: 'minor' });
  });

  it('relative scale change: C major + minor + relative → A minor', () => {
    expect(applyScaleChange('C', 'major', 'minor', 'relative')).toEqual({ key: 'A', scale: 'minor' });
  });

  it('relative scale change: C major + dorian + relative → D dorian', () => {
    expect(applyScaleChange('C', 'major', 'dorian', 'relative')).toEqual({ key: 'D', scale: 'dorian' });
  });

  it('pitchClassSetForKeyScale is stable for regression checks', () => {
    expect(pitchClassSetForKeyScale('C', 'major')).toEqual(new Set([0, 2, 4, 5, 7, 9, 11]));
  });
});
