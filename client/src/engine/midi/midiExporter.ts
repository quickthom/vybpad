import type { SongData, TrackRole } from '@vybpad/shared';

import { buildScheduledPlayEvents, type ScheduledPlayEvent } from '@/engine/audio/songScheduler';
import { getMeterAtMeasure, getTempoAtMeasure } from '@/engine/renderer/tickUtils';
import { theoryEngine } from '@/engine/theory/theoryEngine';

import MidiWriter from 'midi-writer-js';

/** INTERFACES.md — MIDI Export Interface (MidiExporter). */
export interface MidiExporter {
  exportSong(song: SongData): Uint8Array;
  exportMelodyOnly(song: SongData, voice?: number): Uint8Array;
  createDragBlob(song: SongData): Blob;
}

/** PAT-004: internal TPQN 48 → MIDI 480 PPQN. */
export const MIDI_TICK_SCALE = 10;

/** midi-writer-js treats `startTick: 0` as missing; pad so explicit ticks are never 0. */
const MIDI_EXPLICIT_TICK_PAD = 1;

const MELODY_ROLES: readonly TrackRole[] = ['melody1', 'melody2', 'melody3', 'melody4'];

const WRITER_OPTS = { ticksPerBeat: 480 };

function roleForVoice(voice: number | undefined): TrackRole {
  const v = Math.floor(Number.isFinite(voice) ? (voice as number) : 0);
  return MELODY_ROLES[Math.min(3, Math.max(0, v))] ?? 'melody1';
}

function internalTickToMidiTick(tick: number): number {
  return tick * MIDI_TICK_SCALE + MIDI_EXPLICIT_TICK_PAD;
}

function internalDurationToMidiTicks(duration: number): number {
  return duration * MIDI_TICK_SCALE;
}

/** Map song velocity 1–127 → midi-writer’s 1–100 scale. */
function toWriterVelocity(velocity: number): number {
  return Math.min(100, Math.max(1, Math.round((velocity / 127) * 100)));
}

function scheduledEventsToNoteEvents(
  events: ScheduledPlayEvent[],
  channel: number,
): InstanceType<typeof MidiWriter.NoteEvent>[] {
  const out: InstanceType<typeof MidiWriter.NoteEvent>[] = [];
  for (const ev of events) {
    const start = internalTickToMidiTick(ev.tick);
    const dur = internalDurationToMidiTicks(ev.durationTicks);
    out.push(
      new MidiWriter.NoteEvent({
        pitch: ev.midi,
        duration: `T${dur}`,
        startTick: start,
        channel,
        velocity: toWriterVelocity(ev.velocity),
      }),
    );
  }
  return out;
}

/** One writer NoteEvent per chord tone (same start/duration); mirrors scheduler’s per-hit chords. */
function scheduledEventsToHarmonyNoteEvents(
  events: ScheduledPlayEvent[],
  channel: number,
): InstanceType<typeof MidiWriter.NoteEvent>[] {
  const byStart = new Map<number, ScheduledPlayEvent[]>();
  for (const ev of events) {
    const list = byStart.get(ev.tick) ?? [];
    list.push(ev);
    byStart.set(ev.tick, list);
  }
  const ticks = [...byStart.keys()].sort((a, b) => a - b);
  const out: InstanceType<typeof MidiWriter.NoteEvent>[] = [];
  for (const t of ticks) {
    const group = byStart.get(t) ?? [];
    const first = group[0];
    if (!first) continue;
    const start = internalTickToMidiTick(first.tick);
    const dur = internalDurationToMidiTicks(first.durationTicks);
    const pitches = group.map((g) => g.midi);
    out.push(
      new MidiWriter.NoteEvent({
        pitch: pitches,
        duration: `T${dur}`,
        startTick: start,
        channel,
        velocity: toWriterVelocity(first.velocity),
      }),
    );
  }
  return out;
}

function buildConductorTrack(song: SongData): InstanceType<typeof MidiWriter.Track> {
  const track = new MidiWriter.Track();
  const meter = getMeterAtMeasure(song, 0);
  const tempo = getTempoAtMeasure(song, 0);
  track.addTrackName('Conductor');
  track.setTempo(tempo, 0);
  track.setTimeSignature(meter.numerator, meter.denominator, 24, 8);
  return track;
}

function addProgramChangePiano(track: InstanceType<typeof MidiWriter.Track>, channel: number): void {
  track.addEvent(
    new MidiWriter.ProgramChangeEvent({
      channel,
      instrument: 0,
      delta: 0,
    }),
  );
}

function buildWriterFromParts(
  song: SongData,
  parts: {
    melody: ScheduledPlayEvent[];
    harmony: ScheduledPlayEvent[];
    bass: ScheduledPlayEvent[];
  },
): InstanceType<typeof MidiWriter.Writer> {
  const conductor = buildConductorTrack(song);

  const melody = new MidiWriter.Track();
  melody.addTrackName('Melody');
  addProgramChangePiano(melody, 1);
  for (const ev of scheduledEventsToNoteEvents(parts.melody, 1)) {
    melody.addEvent(ev);
  }

  const harmony = new MidiWriter.Track();
  harmony.addTrackName('Harmony');
  addProgramChangePiano(harmony, 2);
  for (const ev of scheduledEventsToHarmonyNoteEvents(parts.harmony, 2)) {
    harmony.addEvent(ev);
  }

  const bass = new MidiWriter.Track();
  bass.addTrackName('Bass');
  addProgramChangePiano(bass, 3);
  for (const ev of scheduledEventsToNoteEvents(parts.bass, 3)) {
    bass.addEvent(ev);
  }

  return new MidiWriter.Writer([conductor, melody, harmony, bass], WRITER_OPTS);
}

function partitionScheduled(song: SongData): {
  melody: ScheduledPlayEvent[];
  harmony: ScheduledPlayEvent[];
  bass: ScheduledPlayEvent[];
} {
  const flat = buildScheduledPlayEvents(song, theoryEngine);
  const melody: ScheduledPlayEvent[] = [];
  const harmony: ScheduledPlayEvent[] = [];
  const bass: ScheduledPlayEvent[] = [];
  for (const ev of flat) {
    if (ev.role === 'harmony') {
      harmony.push(ev);
    } else if (ev.role === 'bass') {
      bass.push(ev);
    } else if (MELODY_ROLES.includes(ev.role)) {
      melody.push(ev);
    }
  }
  return { melody, harmony, bass };
}

function exportSongImpl(song: SongData): Uint8Array {
  const parts = partitionScheduled(song);
  return buildWriterFromParts(song, parts).buildFile();
}

function exportMelodyOnlyImpl(song: SongData, voice?: number): Uint8Array {
  const role = roleForVoice(voice);
  const flat = buildScheduledPlayEvents(song, theoryEngine).filter((ev) => ev.role === role);
  const conductor = buildConductorTrack(song);
  const melody = new MidiWriter.Track();
  melody.addTrackName('Melody');
  addProgramChangePiano(melody, 1);
  for (const ev of scheduledEventsToNoteEvents(flat, 1)) {
    melody.addEvent(ev);
  }
  return new MidiWriter.Writer([conductor, melody], WRITER_OPTS).buildFile();
}

function createDragBlobImpl(song: SongData): Blob {
  const bytes = exportSongImpl(song);
  return new Blob([Uint8Array.from(bytes)], { type: 'audio/midi' });
}

export const midiExporter: MidiExporter = {
  exportSong: exportSongImpl,
  exportMelodyOnly: exportMelodyOnlyImpl,
  createDragBlob: createDragBlobImpl,
};

/** Factory for consumers/tests (single shared implementation). */
export function createMidiExporter(): MidiExporter {
  return midiExporter;
}
