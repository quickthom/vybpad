/**
 * OB-1 / OB-2 — short audition when the user completes a simple click on a note or chord block.
 * Uses the same piano sampler as transport; caller must run `PlaybackStore.initializeAudio()`
 * from the pointer/click handler before this runs (PAT-026).
 */

import type { SongData, TrackRole } from '@vybpad/shared';
import * as Tone from 'tone';

import type { EditorCanvasHit } from '../renderer/hitTest';
import { getKeyAtMeasure, getScaleAtMeasure } from '../renderer/tickUtils';
import { theoryEngine } from '../theory/theoryEngine';
import { buildHarmonyVoicingSequence } from './harmonyVoicing';
import { getPianoInstrument } from './pianoSampleLoader';

const MELODY_ROLES: readonly TrackRole[] = ['melody1', 'melody2', 'melody3', 'melody4'];

function trackForVoice(voice: number): TrackRole {
  return MELODY_ROLES[voice] ?? 'melody1';
}

function getTrackOctave(song: SongData, role: TrackRole): number {
  const tr = song.bandConfig.tracks.find((t) => t.role === role);
  return tr?.octave ?? 0;
}

/** Preview length — brief enough to feel like a “tap”, long enough to hear pitch classes. */
const AUDITION_DURATION_SEC = 0.22;

/**
 * Computes MIDI notes for a canvas hit using the same pitch rules as {@link buildScheduledPlayEvents}
 * (melody) and {@link buildHarmonyVoicingSequence} (harmony + bass).
 */
export function getEditorHitAuditionMidis(song: SongData, hit: EditorCanvasHit): number[] | null {
  if (hit.kind === 'note') {
    if (hit.note.isRest) {
      return null;
    }
    const key = getKeyAtMeasure(song, hit.measureIndex);
    const scale = getScaleAtMeasure(song, hit.measureIndex);
    const role = trackForVoice(hit.voiceIndex);
    const trOct = getTrackOctave(song, role);
    const midi = theoryEngine.scaleDegreeToMidi(
      hit.note.scaleDegree,
      hit.note.octave + trOct,
      hit.note.chromatic,
      key,
      scale,
      4,
    );
    return [midi];
  }

  const steps = buildHarmonyVoicingSequence(song);
  const step = steps.find((s) => s.measureIndex === hit.measureIndex && s.chord.id === hit.chord.id);
  if (!step) {
    return null;
  }
  const { harmonyMidi, bassMidi } = step.voicing;
  return [...harmonyMidi, bassMidi];
}

/**
 * Plays a short simultaneous cluster (no Transport). No-op if the piano is not loaded.
 * Velocities align with {@link buildScheduledPlayEvents} defaults (harmony 72, bass 80).
 */
export function playAuditionMidisNow(midis: readonly number[]): void {
  const piano = getPianoInstrument();
  if (!piano || midis.length === 0) {
    return;
  }
  const now = Tone.now();
  const dur = AUDITION_DURATION_SEC;
  if (midis.length === 1) {
    const note = midis[0];
    piano.start({
      note,
      time: now,
      duration: dur,
      velocity: 88,
    });
    return;
  }
  for (let i = 0; i < midis.length; i += 1) {
    const note = midis[i];
    const isBass = i === midis.length - 1;
    piano.start({
      note,
      time: now,
      duration: dur,
      velocity: isBass ? 80 : 72,
    });
  }
}

/** Resolves audition targets from the hit; safe when the song has no matching harmony step (returns null). */
export function playEditorHitAudition(song: SongData, hit: EditorCanvasHit): void {
  const midis = getEditorHitAuditionMidis(song, hit);
  if (!midis) {
    return;
  }
  playAuditionMidisNow(midis);
}
