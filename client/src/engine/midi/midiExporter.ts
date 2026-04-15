import type { SongData, TimeSignature, TrackRole } from '@vybpad/shared';

import { buildScheduledPlayEvents, type ScheduledPlayEvent } from '@/engine/audio/songScheduler';
import {
  getKeyAtMeasure,
  getMeasureStartTicks,
  getMeterAtMeasure,
  getScaleAtMeasure,
  getTempoAtMeasure,
} from '@/engine/renderer/tickUtils';
import { theoryEngine } from '@/engine/theory';

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

/** SMF meta status (matches midi-writer-js `Constants.META_EVENT_ID`). */
const SMF_META = 0xff;

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

/** Variable-length quantity for SMF delta-times (same semantics as midi-writer-js `Utils.numberToVariableLength`). */
function smfDeltaTimeVlq(deltaTicks: number): number[] {
  let ticks = Math.round(deltaTicks);
  if (ticks < 0 || !Number.isFinite(ticks)) {
    throw new Error('midiExporter: invalid SMF delta time');
  }
  let buffer = ticks & 0x7f;
  while ((ticks >>= 7)) {
    buffer <<= 8;
    buffer |= (ticks & 0x7f) | 0x80;
  }
  const out: number[] = [];
  while (true) {
    out.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return out;
}

function metersEqual(a: TimeSignature, b: TimeSignature): boolean {
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

/**
 * Time signature meta (FF 58) with an explicit leading delta (midi-writer-js `TimeSignatureEvent` always emits delta 0).
 * Denominator must be a power of two (INTERFACES / SMF).
 */
function timeSignatureMetaWithDelta(
  delta: number,
  numerator: number,
  denominator: number,
  midiclockspertick = 24,
  notespermidiclock = 8,
): { data: number[]; delta: number; name: string } {
  const denomPow = Math.round(Math.log2(denominator));
  return {
    name: 'TimeSignatureMeta',
    delta: 0,
    data: [
      ...smfDeltaTimeVlq(delta),
      SMF_META,
      0x58,
      0x04,
      numerator & 0xff,
      denomPow & 0xff,
      midiclockspertick & 0xff,
      notespermidiclock & 0xff,
    ],
  };
}

type ConductorTempoMeterOp =
  | { kind: 'tempo'; absMidiTick: number; bpm: number }
  | { kind: 'meter'; absMidiTick: number; meter: TimeSignature };

/**
 * Tempo map + time-signature changes at measure boundaries, PAT-004 scaled (+ explicit tick pad like notes).
 * Emits baseline at measure 0; later events only when effective tempo/meter differs from the prior measure.
 */
function collectConductorTempoMeterOps(song: SongData): ConductorTempoMeterOp[] {
  const n = song.measures.length;
  const measureStarts = getMeasureStartTicks(song);
  const ops: ConductorTempoMeterOp[] = [];
  const iterations = n === 0 ? 1 : n;

  for (let m = 0; m < iterations; m += 1) {
    const tempo = getTempoAtMeasure(song, m);
    const meter = getMeterAtMeasure(song, m);
    const absInternal = measureStarts[m] ?? 0;
    const absMidiTick = internalTickToMidiTick(absInternal);

    if (m === 0) {
      ops.push({ kind: 'tempo', absMidiTick, bpm: tempo });
      ops.push({ kind: 'meter', absMidiTick, meter });
      continue;
    }

    const prevTempo = getTempoAtMeasure(song, m - 1);
    const prevMeter = getMeterAtMeasure(song, m - 1);
    if (tempo !== prevTempo) {
      ops.push({ kind: 'tempo', absMidiTick, bpm: tempo });
    }
    if (!metersEqual(meter, prevMeter)) {
      ops.push({ kind: 'meter', absMidiTick, meter });
    }
  }

  ops.sort((a, b) => {
    if (a.absMidiTick !== b.absMidiTick) return a.absMidiTick - b.absMidiTick;
    if (a.kind !== b.kind) return a.kind === 'tempo' ? -1 : 1;
    return 0;
  });

  return ops;
}

function applyConductorTempoMeterOps(
  track: InstanceType<typeof MidiWriter.Track>,
  ops: ConductorTempoMeterOp[],
): void {
  let prevAbsTick = 0;
  for (const op of ops) {
    const delta = op.absMidiTick - prevAbsTick;
    prevAbsTick = op.absMidiTick;
    if (op.kind === 'tempo') {
      track.addEvent(
        new MidiWriter.TempoEvent({
          bpm: op.bpm,
          delta,
          tick: op.absMidiTick,
        }),
      );
    } else {
      track.addEvent(
        timeSignatureMetaWithDelta(delta, op.meter.numerator, op.meter.denominator),
      );
    }
  }
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
  track.addTrackName('Conductor');
  applyConductorTempoMeterOps(track, collectConductorTempoMeterOps(song));
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

/**
 * FF 01 text meta at each chord onset. Deltas are cumulative so events align with PAT-004 ×10 + pad,
 * matching {@link internalTickToMidiTick} used for notes.
 */
function buildChordNamesTrack(song: SongData): InstanceType<typeof MidiWriter.Track> {
  const track = new MidiWriter.Track();
  track.addTrackName('Chord names');

  const measureStarts = getMeasureStartTicks(song);
  const marks: { midiTick: number; text: string }[] = [];

  for (let mi = 0; mi < song.measures.length; mi += 1) {
    const measure = song.measures[mi];
    if (!measure) continue;
    const key = getKeyAtMeasure(song, mi);
    const scale = getScaleAtMeasure(song, mi);
    const start = measureStarts[mi] ?? 0;
    for (const chord of measure.chords) {
      const absInternal = start + chord.beat;
      const midiTick = internalTickToMidiTick(absInternal);
      marks.push({
        midiTick,
        text: theoryEngine.toChordName(chord, key, scale),
      });
    }
  }

  marks.sort((a, b) => {
    if (a.midiTick !== b.midiTick) return a.midiTick - b.midiTick;
    return a.text.localeCompare(b.text);
  });

  let prevTick = 0;
  for (const m of marks) {
    const delta = m.midiTick - prevTick;
    track.addEvent(
      new MidiWriter.TextEvent({
        text: m.text,
        delta,
      }),
    );
    prevTick = m.midiTick;
  }

  return track;
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

  const chordNames = buildChordNamesTrack(song);

  return new MidiWriter.Writer([conductor, melody, harmony, bass, chordNames], WRITER_OPTS);
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
