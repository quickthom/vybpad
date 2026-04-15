import type { NoteEvent, NoteName, ScaleType, SongData, TrackRole } from '@vybpad/shared';
import { TICKS_PER_QUARTER } from '@vybpad/shared';

import type { TheoryEngine } from '../theory/theoryEngine';
import { getKeyAtMeasure, getMeasureStartTicks, getScaleAtMeasure } from '../renderer/tickUtils';
import { buildHarmonyVoicingSequence } from './harmonyVoicing';

const MELODY_ROLES: readonly TrackRole[] = ['melody1', 'melody2', 'melody3', 'melody4'] as const;

/** One sampled note line for Tone scheduling (harmony may emit several per chord hit). */
export interface ScheduledPlayEvent {
  tick: number;
  durationTicks: number;
  midi: number;
  velocity: number;
  role: TrackRole;
}

function trackForVoice(voice: number): TrackRole {
  return MELODY_ROLES[voice] ?? 'melody1';
}

function getTrackOctave(song: SongData, role: TrackRole): number {
  const tr = song.bandConfig.tracks.find((t) => t.role === role);
  return tr?.octave ?? 0;
}

/**
 * Builds absolute-tick note events from {@link SongData} for all audible roles (melody 0–3,
 * harmony, bass). Drums are omitted (no drum samples in MVP graph).
 */
export function buildScheduledPlayEvents(
  song: SongData,
  theory: TheoryEngine,
): ScheduledPlayEvent[] {
  const out: ScheduledPlayEvent[] = [];
  const starts = getMeasureStartTicks(song);

  for (let mi = 0; mi < song.measures.length; mi += 1) {
    const m = song.measures[mi];
    const baseTick = starts[mi] ?? 0;
    const key = getKeyAtMeasure(song, mi);
    const scale = getScaleAtMeasure(song, mi);

    for (let voice = 0; voice < 4; voice += 1) {
      const role = trackForVoice(voice);
      const trOct = getTrackOctave(song, role);
      const voiceNotes = m.notes[voice] ?? [];
      for (const note of voiceNotes) {
        if (note.isRest) {
          continue;
        }
        pushMelodyNote(out, theory, note, baseTick, key, scale, trOct, role);
      }
    }
  }

  const harmonySteps = buildHarmonyVoicingSequence(song);
  for (const step of harmonySteps) {
    const { chord, voicing, measureIndex } = step;
    const baseTick = (starts[measureIndex] ?? 0) + chord.beat;
    const endTick = baseTick + chord.duration;
    for (let t = baseTick; t < endTick; t += TICKS_PER_QUARTER) {
      const dur = Math.min(TICKS_PER_QUARTER, endTick - t);
      for (const midi of voicing.harmonyMidi) {
        out.push({
          tick: t,
          durationTicks: dur,
          midi,
          velocity: 72,
          role: 'harmony',
        });
      }
      out.push({
        tick: t,
        durationTicks: dur,
        midi: voicing.bassMidi,
        velocity: 80,
        role: 'bass',
      });
    }
  }

  out.sort((a, b) => a.tick - b.tick || a.midi - b.midi);
  return out;
}

function isTrackAudible(song: SongData, role: TrackRole): boolean {
  const t = song.bandConfig.tracks.find((tr) => tr.role === role);
  if (!t) {
    return true;
  }
  return !t.mute;
}

/**
 * MIDI pitches sounding at `tick` (exclusive end), aligned with {@link buildScheduledPlayEvents} and mixer mute flags.
 * Used by the read-only piano keyboard panel (TASK-7.7).
 */
export function collectActiveMidiNotesAtScheduledEvents(
  events: readonly ScheduledPlayEvent[],
  song: SongData,
  tick: number,
): number[] {
  const set = new Set<number>();
  for (const e of events) {
    if (!isTrackAudible(song, e.role)) {
      continue;
    }
    if (tick >= e.tick && tick < e.tick + e.durationTicks) {
      set.add(e.midi);
    }
  }
  return [...set].sort((a, b) => a - b);
}

function pushMelodyNote(
  out: ScheduledPlayEvent[],
  theory: TheoryEngine,
  note: NoteEvent,
  measureBaseTick: number,
  key: NoteName,
  scale: ScaleType,
  trackOctave: number,
  role: TrackRole,
): void {
  const midi = theory.scaleDegreeToMidi(
    note.scaleDegree,
    note.octave + trackOctave,
    note.chromatic,
    key,
    scale,
    4,
  );
  out.push({
    tick: measureBaseTick + note.beat,
    durationTicks: note.duration,
    midi,
    velocity: note.velocity,
    role,
  });
}
