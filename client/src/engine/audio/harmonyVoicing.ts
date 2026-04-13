import type { ChordEvent, NoteName, ScaleType, SongData } from '@vybpad/shared';

import { getKeyAtMeasure, getMeasureStartTicks, getScaleAtMeasure } from '../renderer/tickUtils';
import { bassMidiPat011, sortedL1Motion, voicingWithVoiceLeading } from '../theory/voicingEngine';

export { baseCloseHarmonyMidi } from '../theory/voicingEngine';

/**
 * PAT-011 harmony output for scheduler integration: harmony voices + bass (slash/root rule via
 * {@link bassMidiPat011}).
 */
export interface HarmonyVoicingParams {
  chord: ChordEvent;
  key: NoteName;
  scale: ScaleType;
  voicingOctave: number;
  prevHarmonyVoicing: readonly number[] | null;
}

export interface HarmonyVoicingResult {
  harmonyMidi: readonly number[];
  bassMidi: number;
}

/**
 * Sorted-voice L1 motion vs previous voicing (same metric as QA `totalL1Sorted`).
 */
export const motionCostBetweenVoicings = sortedL1Motion;

/**
 * Full harmony + bass for one chord (voice leading in {@link voicingWithVoiceLeading}).
 */
export function computeHarmonyVoicing(params: HarmonyVoicingParams): HarmonyVoicingResult {
  const harmonyMidi = voicingWithVoiceLeading(
    params.chord,
    params.key,
    params.scale,
    params.voicingOctave,
    params.prevHarmonyVoicing === null ? null : [...params.prevHarmonyVoicing],
  );
  const bassMidi = bassMidiPat011(params.chord, params.key, params.scale, params.voicingOctave);
  return {
    harmonyMidi,
    bassMidi,
  };
}

/** Effective voicing octave from band config (default harmony center = 4 + track octave). */
export function getHarmonyVoicingOctave(song: SongData): number {
  const t = song.bandConfig.tracks.find((tr) => tr.role === 'harmony');
  return 4 + (t?.octave ?? 0);
}

export interface SongHarmonyVoicingStep {
  measureIndex: number;
  chord: ChordEvent;
  voicing: HarmonyVoicingResult;
}

/**
 * Walks all chord events in score order with voice-leading between consecutive harmony chords.
 */
export function buildHarmonyVoicingSequence(song: SongData): SongHarmonyVoicingStep[] {
  const voicingOctave = getHarmonyVoicingOctave(song);
  const starts = getMeasureStartTicks(song);
  const items: Array<{ measureIndex: number; absBeat: number; chord: ChordEvent }> = [];

  for (let mi = 0; mi < song.measures.length; mi += 1) {
    const m = song.measures[mi];
    const baseTick = starts[mi] ?? 0;
    const chords = [...m.chords].sort((a, b) => a.beat - b.beat);
    for (const chord of chords) {
      items.push({ measureIndex: mi, absBeat: baseTick + chord.beat, chord });
    }
  }

  items.sort((a, b) => a.absBeat - b.absBeat || a.measureIndex - b.measureIndex);

  let prev: number[] | null = null;
  const out: SongHarmonyVoicingStep[] = [];

  for (const it of items) {
    const key = getKeyAtMeasure(song, it.measureIndex);
    const scale = getScaleAtMeasure(song, it.measureIndex);
    const voicing = computeHarmonyVoicing({
      chord: it.chord,
      key,
      scale,
      voicingOctave,
      prevHarmonyVoicing: prev,
    });
    out.push({ measureIndex: it.measureIndex, chord: it.chord, voicing });
    prev = [...voicing.harmonyMidi];
  }

  return out;
}

export function assertValidHarmonyVoicingSong(song: SongData): void {
  const seq = buildHarmonyVoicingSequence(song);
  for (const step of seq) {
    for (const n of step.voicing.harmonyMidi) {
      if (n < 0 || n > 127) {
        throw new Error(`Harmony voicing out of MIDI range: ${n}`);
      }
    }
    const b = step.voicing.bassMidi;
    if (b < 0 || b > 127) {
      throw new Error(`Bass voicing out of MIDI range: ${b}`);
    }
  }
}
