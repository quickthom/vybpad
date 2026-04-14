/**
 * TASK-5.4 — inversion / embellishment cycling helpers (INTERFACES.md `ChordEvent`).
 * UX §8: shortcuts `i` / `e` documented on keyboard handler tests (useKeyboard.task-5-4).
 */
import type { ChordEvent } from '@vybpad/shared';
import { describe, expect, it } from 'vitest';

import { nextCycledEmbellishment, nextCycledInversion } from '../../../../src/components/editor/editorKeyboardLogic';

function baseChord(over: Partial<ChordEvent> = {}): ChordEvent {
  return {
    id: 'c1',
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
    ...over,
  };
}

describe('editorKeyboardLogic — TASK-5.4 — nextCycledInversion', () => {
  it('cycles 0→1→2→0 for triads (no seventh; inversion 3 not used)', () => {
    let c = baseChord({ inversion: 0 });
    c = { ...c, inversion: nextCycledInversion(c) };
    expect(c.inversion).toBe(1);
    c = { ...c, inversion: nextCycledInversion(c) };
    expect(c.inversion).toBe(2);
    c = { ...c, inversion: nextCycledInversion(c) };
    expect(c.inversion).toBe(0);
  });

  it('includes inversion 3 only when seventh is non-none', () => {
    let c = baseChord({ seventh: 'dom7', inversion: 2 });
    c = { ...c, inversion: nextCycledInversion(c) };
    expect(c.inversion).toBe(3);
    c = { ...c, inversion: nextCycledInversion(c) };
    expect(c.inversion).toBe(0);
  });

  it('clamps illegal inversion 3 on triad before advancing', () => {
    const c = baseChord({ seventh: 'none', inversion: 3 });
    expect(nextCycledInversion(c)).toBe(0);
  });
});

describe('editorKeyboardLogic — TASK-5.4 — nextCycledEmbellishment', () => {
  it('follows INTERFACES document order: sevenths, then sus2/sus4, then add9/11/13', () => {
    let c = baseChord();
    const seq: string[] = [];
    for (let n = 0; n < 12; n++) {
      const next = nextCycledEmbellishment(c);
      seq.push(`${next.seventh}/${next.suspension}/${next.addition}`);
      c = { ...c, ...next };
    }
    expect(seq[0]).toBe('maj7/none/none');
    expect(seq[4]).toBe('min7b5/none/none');
    expect(seq[5]).toBe('none/sus2/none');
    expect(seq[6]).toBe('none/sus4/none');
    expect(seq[7]).toBe('none/none/add9');
    expect(seq[10]).toBe('none/none/none');
    expect(seq[11]).toBe('maj7/none/none');
  });

  it('maps unknown triples like index 0 so the next step is the first embellishment step', () => {
    const weird = baseChord({ seventh: 'dom7', suspension: 'sus4', addition: 'none' });
    const next = nextCycledEmbellishment(weird);
    expect(next).toEqual(nextCycledEmbellishment(baseChord()));
  });
});
