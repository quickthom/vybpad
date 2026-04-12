import type { ChordEvent, SongData, Viewport } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import { theoryEngine } from '../../../../src/engine/theory/theoryEngine';
import {
  BEAT_WIDTH,
  CHORD_AREA_HEIGHT,
  chordBlockLabelLines,
  chordBlockTextStyle,
  CHORD_FILL_BLEND_ALPHA,
  effectiveDegreeForChordColor,
  layoutChordBlock,
  PAT010_DEGREE_HEX,
  pixelsPerTick,
  TPQN,
} from '../../../../src/engine/renderer/index';

function minimalSong(measures: { chords: ChordEvent[]; key?: 'C'; scale?: 'major' }[]): SongData {
  const m = measures.map((row, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i}`,
    chords: row.chords,
    notes: [[], [], [], []] as const,
    ...(row.key || row.scale
      ? {
          changes: {
            ...(row.key ? { key: row.key } : {}),
            ...(row.scale ? { scale: row.scale } : {}),
          },
        }
      : {}),
  }));
  return {
    version: '1.0',
    metadata: {
      title: 't',
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: m,
    bandConfig: { tracks: [] },
  };
}

function chord(partial: Partial<ChordEvent> & Pick<ChordEvent, 'scaleDegree' | 'quality'>): ChordEvent {
  return {
    id: 'c1',
    scaleDegree: partial.scaleDegree,
    quality: partial.quality,
    seventh: partial.seventh ?? 'none',
    suspension: partial.suspension ?? 'none',
    addition: partial.addition ?? 'none',
    inversion: partial.inversion ?? 0,
    borrowed: partial.borrowed ?? null,
    secondary: partial.secondary ?? null,
    beat: partial.beat ?? 0,
    duration: partial.duration ?? 48,
  };
}

describe('chordBlocks (TASK-2.4)', () => {
  it('criterion 1: block width = duration × pixelsPerTick(zoom); height = CHORD_AREA_HEIGHT; Y = chord strip', () => {
    const song = minimalSong([
      { chords: [chord({ scaleDegree: 1, quality: 'major', duration: 96 })] },
    ]);
    const viewport: Viewport = { startMeasure: 0, measureCount: 1, scrollY: 0, zoom: 2 };
    const c = song.measures[0].chords[0];
    const rect = layoutChordBlock(c, 0, song, viewport);
    expect(rect.height).toBe(CHORD_AREA_HEIGHT);
    expect(rect.y).toBe(24);
    expect(rect.width).toBe(96 * pixelsPerTick(2));
    expect(rect.width).toBe((96 / TPQN) * BEAT_WIDTH * 2);
  });

  it('criterion 2: fill blends PAT-010 hue at UX opacity; text style picks dark when contrast suffices', () => {
    const red = PAT010_DEGREE_HEX[0];
    const fill = `rgb(${Math.round(255 * (1 - CHORD_FILL_BLEND_ALPHA) + parseInt(red.slice(1, 3), 16) * CHORD_FILL_BLEND_ALPHA)},${Math.round(255 * (1 - CHORD_FILL_BLEND_ALPHA) + parseInt(red.slice(3, 5), 16) * CHORD_FILL_BLEND_ALPHA)},${Math.round(255 * (1 - CHORD_FILL_BLEND_ALPHA) + parseInt(red.slice(5, 7), 16) * CHORD_FILL_BLEND_ALPHA)})`;
    const style = chordBlockTextStyle(fill);
    expect(style.fill).toBe('#111827');
    expect(style.shadow).toBe(false);
  });

  it('criterion 3: labels use theoryEngine Roman + chord name with per-measure key/scale', () => {
    const song = minimalSong([
      { chords: [] },
      {
        chords: [chord({ scaleDegree: 5, quality: 'major', beat: 0, duration: 48 })],
        key: 'C',
        scale: 'major',
      },
    ]);
    const key = 'G';
    const scale = 'major';
    const ch = song.measures[1].chords[0];
    const { romanLine, absoluteLine } = chordBlockLabelLines(ch, key, scale, theoryEngine);
    expect(romanLine).toBe(theoryEngine.toRomanNumeral(ch, scale));
    expect(absoluteLine).toBe(theoryEngine.toChordName(ch, key, scale));
    expect(romanLine).toContain('V');
    expect(absoluteLine).toMatch(/^D/);
  });

  it('criterion 3b: effective diatonic degree follows ChordEvent (secondary V/V → degree 2)', () => {
    const ch = chord({
      scaleDegree: 2,
      quality: 'major',
      secondary: { function: 'V', target: 5 },
    });
    expect(effectiveDegreeForChordColor(ch, 'C', 'major', 'diatonic')).toBe(2);
  });

  it('criterion 4: Roman line carries figured / quality from theoryEngine (V7 in major)', () => {
    const ch = chord({ scaleDegree: 5, quality: 'major', seventh: 'dom7' });
    const { romanLine } = chordBlockLabelLines(ch, 'C', 'major', theoryEngine);
    expect(romanLine).toBe('V7');
  });
});
