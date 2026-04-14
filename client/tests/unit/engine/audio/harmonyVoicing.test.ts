/*
 * QA — TASK 4.3 — PAT-011 harmony voicing + voice leading
 */

import type { ChordEvent } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import {
  assertValidHarmonyVoicingSong,
  baseCloseHarmonyMidi,
  buildHarmonyVoicingSequence,
  computeHarmonyVoicing,
  motionCostBetweenVoicings,
} from '@/engine/audio';
import { buildDefaultSong } from '@/store/songStore';

function chord(overrides: Partial<ChordEvent>): ChordEvent {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    scaleDegree: 1,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat: 0,
    duration: 48,
    ...overrides,
  };
}

describe('harmonyVoicing — PAT-011 + voice leading', () => {
  it('is deterministic for identical params and previous voicing', () => {
    const c = chord({ scaleDegree: 1, quality: 'major' });
    const prev = computeHarmonyVoicing({
      chord: c,
      key: 'C',
      scale: 'major',
      voicingOctave: 4,
      prevHarmonyVoicing: null,
    }).harmonyMidi;
    const a = computeHarmonyVoicing({
      chord: chord({ scaleDegree: 4, quality: 'major' }),
      key: 'C',
      scale: 'major',
      voicingOctave: 4,
      prevHarmonyVoicing: prev,
    });
    const b = computeHarmonyVoicing({
      chord: chord({ scaleDegree: 4, quality: 'major' }),
      key: 'C',
      scale: 'major',
      voicingOctave: 4,
      prevHarmonyVoicing: prev,
    });
    expect(a.harmonyMidi).toEqual(b.harmonyMidi);
    expect(a.bassMidi).toBe(b.bassMidi);
  });

  it('returns 3 MIDI notes for triads and 4 for seventh chords in valid range', () => {
    const tri = computeHarmonyVoicing({
      chord: chord({ scaleDegree: 1, quality: 'major', seventh: 'none' }),
      key: 'C',
      scale: 'major',
      voicingOctave: 4,
      prevHarmonyVoicing: null,
    });
    expect(tri.harmonyMidi).toHaveLength(3);
    for (const n of tri.harmonyMidi) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(127);
    }

    const dom7 = computeHarmonyVoicing({
      chord: chord({ scaleDegree: 5, quality: 'major', seventh: 'dom7' }),
      key: 'C',
      scale: 'major',
      voicingOctave: 4,
      prevHarmonyVoicing: null,
    });
    expect(dom7.harmonyMidi).toHaveLength(4);
  });

  it('sets bass one octave below the lowest harmony note', () => {
    const r = computeHarmonyVoicing({
      chord: chord({ scaleDegree: 1, quality: 'major' }),
      key: 'C',
      scale: 'major',
      voicingOctave: 4,
      prevHarmonyVoicing: null,
    });
    const low = r.harmonyMidi[0];
    expect(r.bassMidi).toBe(low - 12);
  });

  it('does not increase motion vs naive same-octave voicing for I→IV in C (common-tone path)', () => {
    const key = 'C';
    const scale = 'major';
    const oct = 4;
    const cMaj = chord({ scaleDegree: 1, quality: 'major' });
    const fMaj = chord({ scaleDegree: 4, quality: 'major' });

    const first = computeHarmonyVoicing({
      chord: cMaj,
      key,
      scale,
      voicingOctave: oct,
      prevHarmonyVoicing: null,
    });
    const prev = [...first.harmonyMidi];

    const naive = baseCloseHarmonyMidi(fMaj, key, scale, oct);
    const smart = computeHarmonyVoicing({
      chord: fMaj,
      key,
      scale,
      voicingOctave: oct,
      prevHarmonyVoicing: prev,
    });

    const costNaive = motionCostBetweenVoicings(prev, naive);
    const costSmart = motionCostBetweenVoicings(prev, smart.harmonyMidi);
    expect(costSmart).toBeLessThanOrEqual(costNaive);
  });

  it('reduces total motion on a ii–V–I segment vs fixed-register close voicings', () => {
    const key = 'C';
    const scale = 'major';
    const oct = 4;

    const prog = [
      chord({ scaleDegree: 2, quality: 'minor' }),
      chord({ scaleDegree: 5, quality: 'major', seventh: 'dom7' }),
      chord({ scaleDegree: 1, quality: 'major' }),
    ];

    let prev: number[] | null = null;
    let led = 0;
    let fixed = 0;

    for (const ch of prog) {
      const naive = baseCloseHarmonyMidi(ch, key, scale, oct);
      if (prev !== null) {
        fixed += motionCostBetweenVoicings(prev, naive);
      }
      const step = computeHarmonyVoicing({
        chord: ch,
        key,
        scale,
        voicingOctave: oct,
        prevHarmonyVoicing: prev,
      });
      if (prev !== null) {
        led += motionCostBetweenVoicings(prev, step.harmonyMidi);
      }
      prev = [...step.harmonyMidi];
    }

    expect(led).toBeLessThanOrEqual(fixed);
  });

  it('covers secondary + inversion in buildHarmonyVoicingSequence without invalid MIDI', () => {
    const song = buildDefaultSong();
    song.measures[0].chords = [
      chord({
        id: '20000000-0000-4000-8000-000000000001',
        scaleDegree: 1,
        quality: 'major',
        inversion: 2,
        beat: 0,
      }),
      chord({
        id: '20000000-0000-4000-8000-000000000002',
        scaleDegree: 5,
        quality: 'major',
        inversion: 1,
        secondary: { function: 'V', target: 5 },
        beat: 48,
      }),
    ];

    expect(() => assertValidHarmonyVoicingSong(song)).not.toThrow();
    const seq = buildHarmonyVoicingSequence(song);
    expect(seq).toHaveLength(2);
  });
});
