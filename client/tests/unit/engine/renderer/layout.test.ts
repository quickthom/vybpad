import type { Measure, SongData } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  absoluteTickFromMeasurePosition,
  absoluteTickToViewportX,
  BEAT_WIDTH,
  chromaticYOffset,
  getMeasureStartTicks,
  diatonicRowToDegreeAndOctave,
  measureLengthInTicks,
  measureWidthPixels,
  noteRowY,
  pixelsPerTick,
  songXFromAbsoluteTick,
  TPQN,
  xFromMeasureLocalTick,
} from '../../../../src/engine/renderer/layout';

function emptyMeasure(id: string): Measure {
  return { id, chords: [], notes: [[], [], [], []] };
}

function minimalSong44(measureCount: number): SongData {
  const measures: Measure[] = [];
  for (let i = 0; i < measureCount; i++) {
    measures.push(emptyMeasure(`00000000-0000-4000-8000-00000000000${i}`));
  }
  return {
    version: '1.0',
    metadata: {
      title: 't',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures,
    bandConfig: {
      tracks: [],
    },
  };
}

describe('layout engine (TASK-2.2)', () => {
  it('uses 48 TPQN and PAT-004 measure length for 4/4', () => {
    expect(TPQN).toBe(48);
    expect(measureLengthInTicks({ numerator: 4, denominator: 4 })).toBe(192);
  });

  it('4/4 measure width at zoom 1 and 2 (four beats × BEAT_WIDTH × zoom)', () => {
    const song = minimalSong44(4);
    expect(measureWidthPixels(song, 0, 1)).toBe(4 * BEAT_WIDTH);
    expect(measureWidthPixels(song, 0, 2)).toBe(4 * BEAT_WIDTH * 2);
  });

  it('maps local tick to x within a measure (one beat = 48 ticks)', () => {
    expect(pixelsPerTick(1)).toBe(BEAT_WIDTH / TPQN);
    expect(xFromMeasureLocalTick(48, 1)).toBe(BEAT_WIDTH);
    expect(xFromMeasureLocalTick(48, 2)).toBe(BEAT_WIDTH * 2);
  });

  it('maps absolute tick to song X and respects measure boundaries', () => {
    const song = minimalSong44(3);
    const starts = getMeasureStartTicks(song);
    expect(starts).toEqual([0, 192, 384, 576]);

    expect(absoluteTickFromMeasurePosition(song, 0, 0)).toBe(0);
    expect(absoluteTickFromMeasurePosition(song, 1, 0)).toBe(192);
    expect(absoluteTickFromMeasurePosition(song, 2, 48)).toBe(384 + 48);

    expect(songXFromAbsoluteTick(192, 1)).toBe(192 * pixelsPerTick(1));
    expect(songXFromAbsoluteTick(192, 1)).toBe(4 * BEAT_WIDTH);
  });

  it('applies meter changes when computing measure start ticks', () => {
    const song: SongData = {
      version: '1.0',
      metadata: {
        title: 't',
        key: 'C',
        scale: 'major',
        tempo: 120,
        meter: { numerator: 2, denominator: 4 },
      },
      measures: [
        { ...emptyMeasure('a'), changes: undefined },
        {
          ...emptyMeasure('b'),
          changes: { meter: { numerator: 4, denominator: 4 } },
        },
      ],
      bandConfig: { tracks: [] },
    };
    // Measure 0: 2/4 → 96 ticks; measure 1: 4/4 → 192 ticks
    expect(getMeasureStartTicks(song)).toEqual([0, 96, 288]);
  });

  it('viewport X is relative to startMeasure', () => {
    const song = minimalSong44(4);
    const viewport = { startMeasure: 1, measureCount: 2, scrollY: 0, zoom: 1 };
    const xBar1 = songXFromAbsoluteTick(192, 1);
    expect(absoluteTickToViewportX(192, viewport, song)).toBe(0);
    expect(absoluteTickToViewportX(192 + 48, viewport, song)).toBe(BEAT_WIDTH);
    expect(absoluteTickToViewportX(0, viewport, song)).toBe(-xBar1);
  });

  it('PAT-018 chromatic offset is half a row per semitone', () => {
    expect(chromaticYOffset(0)).toBe(0);
    expect(chromaticYOffset(1)).toBe(10);
    expect(chromaticYOffset(-1)).toBe(-10);
    const y0 = noteRowY(1, 0, 0, 0);
    const ySharp = noteRowY(1, 0, 1, 0);
    expect(ySharp - y0).toBe(10);
  });

  it('maps negative diatonic row indices to valid scale-degree/octave pairs (reverse-row drag safety)', () => {
    expect(diatonicRowToDegreeAndOctave(-1)).toEqual({ scaleDegree: 7, octave: -1 });
    expect(diatonicRowToDegreeAndOctave(-7)).toEqual({ scaleDegree: 1, octave: -1 });
    expect(diatonicRowToDegreeAndOctave(-8)).toEqual({ scaleDegree: 7, octave: -2 });
  });
});
