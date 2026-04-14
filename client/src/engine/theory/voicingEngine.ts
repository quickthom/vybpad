import type { ChordEvent, NoteName, ScaleDegree, ScaleType } from '@vybpad/shared';

import { chordToMidiNotes } from './chords';
import { getSecondaryChordMidi } from './secondaryChords';
import { scaleDegreeToMidi } from './scaleDegreeToMidi';

/**
 * TASK-4.3 — Harmony voicing + voice leading (PAT-011).
 * Register search minimizes **sorted-voice** L1 distance vs the previous voicing (matches QA hooks).
 */

function clampMidi(m: number): number {
  return Math.max(0, Math.min(127, Math.round(m)));
}

export function baseCloseHarmonyMidi(
  chord: ChordEvent,
  key: NoteName,
  scale: ScaleType,
  voicingOctave: number,
): number[] {
  if (chord.secondary) {
    return getSecondaryChordMidi(chord.secondary, chord, key, scale, voicingOctave);
  }
  return chordToMidiNotes(chord, key, scale, voicingOctave);
}

function transposeAll(midis: readonly number[], semis: number): number[] {
  return midis.map((m) => clampMidi(m + semis));
}

function enumerateRegisterCandidates(base: readonly number[]): number[][] {
  const out: number[][] = [];
  for (let k = -3; k <= 3; k += 1) {
    const shifted = transposeAll(base, k * 12);
    if (shifted.every((m) => m >= 0 && m <= 127)) {
      out.push([...shifted].sort((a, b) => a - b));
    }
  }
  return out;
}

/** k-combinations of indices 0..n-1 (deterministic order for tie-breaking callers). */
function indexCombinations(n: number, k: number): number[][] {
  if (k < 0 || k > n) {
    return [];
  }
  if (k === 0) {
    return [[]];
  }
  const res: number[][] = [];
  const path: number[] = [];
  function dfs(start: number) {
    if (path.length === k) {
      res.push([...path]);
      return;
    }
    for (let i = start; i < n; i += 1) {
      path.push(i);
      dfs(i + 1);
      path.pop();
    }
  }
  dfs(0);
  return res;
}

/**
 * L1 distance between equal-length voicings after sorting (QA `totalL1Sorted`).
 * Unequal lengths return Infinity — use {@link pat011MotionScore} for register optimization.
 */
export function sortedL1Motion(prev: readonly number[], cand: readonly number[]): number {
  const a = [...prev].sort((x, y) => x - y);
  const b = [...cand].sort((x, y) => x - y);
  if (a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }
  let s = 0;
  for (let i = 0; i < a.length; i += 1) {
    s += Math.abs(a[i] - b[i]);
  }
  return s;
}

/**
 * PAT-011 motion cost: sorted index-wise L1 when |prev| = |cand|; otherwise minimum total L1 over
 * best subset pairing (choose which voices align when cardinality changes — triad ↔ seventh).
 * Finite and deterministic for all non-empty MIDI sets used in close voicing.
 */
export function pat011MotionScore(prev: readonly number[], cand: readonly number[]): number {
  const m = prev.length;
  const n = cand.length;
  if (m === 0 || n === 0) {
    return 0;
  }
  const p = [...prev].sort((a, b) => a - b);
  const c = [...cand].sort((a, b) => a - b);

  if (m === n) {
    let s = 0;
    for (let i = 0; i < m; i += 1) {
      s += Math.abs(p[i] - c[i]);
    }
    return s;
  }

  if (m < n) {
    let best = Infinity;
    for (const idx of indexCombinations(n, m)) {
      const sub = idx
        .map((i) => c[i])
        .slice()
        .sort((a, b) => a - b);
      let s = 0;
      for (let i = 0; i < m; i += 1) {
        s += Math.abs(p[i] - sub[i]);
      }
      best = Math.min(best, s);
    }
    return best;
  }

  let best = Infinity;
  for (const idx of indexCombinations(m, n)) {
    const sub = idx
      .map((i) => p[i])
      .slice()
      .sort((a, b) => a - b);
    let s = 0;
    for (let i = 0; i < n; i += 1) {
      s += Math.abs(sub[i] - c[i]);
    }
    best = Math.min(best, s);
  }
  return best;
}

function lexLess(a: readonly number[], b: readonly number[]): boolean {
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  const len = Math.min(sa.length, sb.length);
  for (let i = 0; i < len; i += 1) {
    const x = sa[i];
    const y = sb[i];
    if (x !== y) {
      return (x ?? 0) < (y ?? 0);
    }
  }
  return sa.length < sb.length;
}

/**
 * Close-position harmony MIDI for `chord`, with whole-chord octave shifts chosen to minimize
 * sorted L1 motion vs `previousHarmonyMidi` (PAT-011). With no previous voicing, returns base close
 * voicing from the theory engine.
 */
export function voicingWithVoiceLeading(
  chord: ChordEvent,
  key: NoteName,
  scale: ScaleType,
  voicingOctave: number,
  previousHarmonyMidi: number[] | null,
): number[] {
  const base = baseCloseHarmonyMidi(chord, key, scale, voicingOctave);

  if (previousHarmonyMidi === null || previousHarmonyMidi.length === 0) {
    return [...base].sort((a, b) => a - b);
  }

  const prev = [...previousHarmonyMidi].sort((a, b) => a - b);
  const candidates = enumerateRegisterCandidates(base);
  let bestCost = Infinity;
  let best: number[] | null = null;

  for (const cand of candidates) {
    const cost = pat011MotionScore(prev, cand);
    if (best === null) {
      bestCost = cost;
      best = cand;
      continue;
    }
    if (cost < bestCost || (cost === bestCost && lexLess(cand, best))) {
      bestCost = cost;
      best = cand;
    }
  }

  return best ?? [...base].sort((a, b) => a - b);
}

/**
 * PAT-011 bass: chord root (or inversion bass / slash bass) one octave below the harmony voicing
 * center — realized as that bass pitch class at `harmonyCenterOctave - 1` (INTERFACES base octave).
 */
export function bassMidiPat011(
  chord: ChordEvent,
  key: NoteName,
  scale: ScaleType,
  harmonyCenterOctave: number,
): number {
  // Same spelling path as harmony (`baseCloseHarmonyMidi` → secondary / borrowed aware).
  const voicing = baseCloseHarmonyMidi(chord, key, scale, harmonyCenterOctave);
  const sorted = [...voicing].sort((a, b) => a - b);
  const lowest = sorted[0];
  if (lowest === undefined) {
    return 0;
  }
  const bassPc = ((lowest % 12) + 12) % 12;
  const baseOct = harmonyCenterOctave - 1;

  for (let d = 1; d <= 7; d += 1) {
    const deg = d as ScaleDegree;
    const m = scaleDegreeToMidi(deg, 0, 0, key, scale, baseOct);
    if (((m % 12) + 12) % 12 === bassPc) {
      return clampMidi(m);
    }
  }

  return clampMidi(lowest - 12);
}
