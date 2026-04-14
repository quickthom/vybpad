/**
 * QA COVERAGE — TASK-5.9 milestone playback sweep
 *
 * ROADMAP Phase 5 milestone mapping:
 * - Borrowed chord + secondary + inversion + embellishment: fixture contains all four and playback
 *   must still schedule harmony/bass events at their measure-relative ticks.
 * - Key change at measure 5: melody MIDI after measure 5 must use the overridden key/scale context.
 * - Meter + tempo change at measure 9: cumulative tick and transport-time boundaries must shift at
 *   measure 9, and later events must land on the shorter 3/4 grid.
 * - Second voice: `SongData.notes[1]` must schedule as `melody2`.
 */
import { buildScheduledPlayEvents } from '@/engine/audio/songScheduler';
import { getMeasureStartTicks, getMeasureStartTransportTimes } from '@/engine/renderer/tickUtils';
import { theoryEngine } from '@/engine/theory/theoryEngine';
import { buildPhase5MilestoneSong } from '../../../fixtures/phase5MilestoneSong';
import { describe, expect, it } from 'vitest';

describe('TASK-5.9 — Phase 5 milestone playback sweep', () => {
  it('keeps advanced harmony events schedulable for borrowed, secondary, inversion, and embellishment chords', () => {
    const song = buildPhase5MilestoneSong();
    const events = buildScheduledPlayEvents(song, theoryEngine);

    const harmonyAtBorrowed = events.filter((event) => event.role === 'harmony' && event.tick === 96);
    const bassAtBorrowed = events.filter((event) => event.role === 'bass' && event.tick === 96);
    const harmonyAtSecondary = events.filter((event) => event.role === 'harmony' && event.tick === 192);
    const bassAtSecondary = events.filter((event) => event.role === 'bass' && event.tick === 192);

    expect(harmonyAtBorrowed.length).toBeGreaterThan(0);
    expect(bassAtBorrowed.length).toBe(1);
    expect(harmonyAtSecondary.length).toBeGreaterThan(0);
    expect(bassAtSecondary.length).toBe(1);
  });

  it('schedules measure-5 melody in the overridden key context and includes the second voice as melody2', () => {
    const song = buildPhase5MilestoneSong();
    const events = buildScheduledPlayEvents(song, theoryEngine);
    const measure5StartTick = getMeasureStartTicks(song)[4];

    const melody1AtMeasure5 = events.find((event) => event.role === 'melody1' && event.tick === measure5StartTick);
    const melody2AtMeasure5 = events.find((event) => event.role === 'melody2' && event.tick === measure5StartTick + 48);

    expect(melody1AtMeasure5).toBeDefined();
    expect(melody2AtMeasure5).toBeDefined();
    expect(melody1AtMeasure5?.midi).toBe(theoryEngine.scaleDegreeToMidi(1, 0, 0, 'D', 'minor', 4));
    expect(melody2AtMeasure5?.midi).toBe(theoryEngine.scaleDegreeToMidi(5, 0, 0, 'D', 'minor', 4));
  });

  it('recomputes measure-9 tick and transport boundaries for the 3/4, 240-BPM override', () => {
    const song = buildPhase5MilestoneSong();

    const starts = getMeasureStartTicks(song);
    const transportTimes = getMeasureStartTransportTimes(song);
    const measure9StartTick = starts[8];
    const measure10StartTick = starts[9];
    const measure9StartSeconds = transportTimes[8];
    const measure10StartSeconds = transportTimes[9];

    expect(measure9StartTick).toBe(1536);
    expect(measure10StartTick).toBe(1680);
    expect(measure9StartSeconds).toBeCloseTo(6.4, 5);
    expect(measure10StartSeconds).toBeCloseTo(7.15, 5);

    const events = buildScheduledPlayEvents(song, theoryEngine);
    const melody1Measure9 = events.find((event) => event.role === 'melody1' && event.tick === measure9StartTick);
    const melody2Measure10 = events.find((event) => event.role === 'melody2' && event.tick === measure10StartTick + 72);

    expect(melody1Measure9).toBeDefined();
    expect(melody2Measure10).toBeDefined();
  });
});
