/**
 * QA COVERAGE PLAN — UI-W5 / REF_AUDIT_1 RA-7
 *
 * Criterion — Scheduler respects editor melody visibility (separate from mixer mute):
 *   happy: when voices 0 and 1 have notes and both lanes are visible and unmuted, scheduled
 *     events include melody1 and melody2 roles
 *   error / filtering: when voice 1 is hidden via melodyVoiceVisible[1]=false, no melody2
 *     scheduled events are produced for that song (editor visibility gates playback)
 *   edges: bandConfig melody2 mute still excludes melody2 from audible path (existing mute contract)
 *
 * ASSUMPTIONS (documented for Builder):
 * - `buildScheduledPlayEvents` gains an optional third argument
 *   `{ melodyVoiceVisible?: readonly [boolean, boolean, boolean, boolean] }` defaulting to all true,
 *   OR equivalent exported helper — INTERFACES.md documents UI visibility on `UIStore` separately
 *   from `BandConfig` mute; playback must respect both.
 */
import type { NoteEvent, SongData } from '@vybpad/shared';
import { buildScheduledPlayEvents } from '@/engine/audio/songScheduler';
import type { TheoryEngine } from '@/engine/theory/theoryEngine';
import { theoryEngine } from '@/engine/theory/theoryEngine';
import { buildDefaultSong } from '@/store/songStore';
import { describe, expect, it } from 'vitest';

function makeNote(partial: Partial<NoteEvent> & Pick<NoteEvent, 'beat' | 'duration'>): NoteEvent {
  return {
    id: crypto.randomUUID(),
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    velocity: 100,
    isRest: false,
    ...partial,
  };
}

/** Song with one non-rest note in voice 0 and one in voice 1 (measure 0); melody2 unmuted. */
function songTwoVoicesUnmuted(): SongData {
  const song = buildDefaultSong();
  const m = song.measures[0];
  m.notes[0].push(makeNote({ beat: 0, duration: 48 }));
  m.notes[1].push(makeNote({ scaleDegree: 3, beat: 48, duration: 48 }));
  const melody2 = song.bandConfig.tracks.find((t) => t.role === 'melody2');
  if (melody2) {
    melody2.mute = false;
  }
  return song;
}

type MelodyVisibility = readonly [boolean, boolean, boolean, boolean];

type BuildWithVisibility = (
  song: SongData,
  theory: TheoryEngine,
  opts?: { melodyVoiceVisible?: MelodyVisibility },
) => ReturnType<typeof buildScheduledPlayEvents>;

const build = buildScheduledPlayEvents as unknown as BuildWithVisibility;

describe('Song scheduler — UI-W5 — RA-7 melody lanes + visibility', () => {
  it('includes melody1 and melody2 scheduled events when both voices have notes, lanes visible, and melody2 unmuted', () => {
    const song = songTwoVoicesUnmuted();
    const events = build(song, theoryEngine, {
      melodyVoiceVisible: [true, true, true, true] as const,
    });
    expect(events.some((e) => e.role === 'melody1')).toBe(true);
    expect(events.some((e) => e.role === 'melody2')).toBe(true);
  });

  it('omits melody2 scheduled events when editor hides melody voice 1 even if the track is unmuted', () => {
    const song = songTwoVoicesUnmuted();
    const events = build(song, theoryEngine, {
      melodyVoiceVisible: [true, false, true, true] as const,
    });
    expect(events.some((e) => e.role === 'melody1')).toBe(true);
    expect(events.some((e) => e.role === 'melody2')).toBe(false);
  });
});
