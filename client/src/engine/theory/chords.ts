import type {
  ChordEvent,
  ChordQuality,
  NoteName,
  ScaleDegree,
  ScaleType,
  SeventhType,
} from '@vybpad/shared';
import { scaleDegreeToMidi } from './scaleDegreeToMidi';
import { getScaleIntervals } from './scales';

/**
 * Returns the natural triad quality for a scale degree in the given scale/mode.
 * Uses tertian stacking (thirds) on that degree within the scale.
 */
export function getDiatonicQuality(degree: ScaleDegree, scale: ScaleType): ChordQuality {
  const intervals = getScaleIntervals(scale);
  const rootIdx = degree - 1;
  const thirdIdx = (rootIdx + 2) % 7;
  const fifthIdx = (rootIdx + 4) % 7;

  const third = semitoneUp(intervals, rootIdx, thirdIdx);
  const fifth = semitoneUp(intervals, rootIdx, fifthIdx);

  return classifyTriad(third, fifth);
}

/**
 * Returns the natural seventh chord type for a tertian seventh chord built on this degree.
 */
export function getDiatonicSeventh(degree: ScaleDegree, scale: ScaleType): SeventhType {
  const intervals = getScaleIntervals(scale);
  const rootIdx = degree - 1;
  const thirdIdx = (rootIdx + 2) % 7;
  const fifthIdx = (rootIdx + 4) % 7;
  const seventhIdx = (rootIdx + 6) % 7;

  const third = semitoneUp(intervals, rootIdx, thirdIdx);
  const fifth = semitoneUp(intervals, rootIdx, fifthIdx);
  const seventh = semitoneUp(intervals, rootIdx, seventhIdx);

  const triad = classifyTriad(third, fifth);
  return classifySeventhChord(triad, seventh);
}

/**
 * Builds MIDI note numbers for a close-position chord voicing (PAT-011).
 * Root uses the parallel mode in `chord.borrowed` when set; otherwise `scale`.
 * Secondary metadata does not change pitch spelling (quality/seventh are explicit on the event).
 */
export function chordToMidiNotes(
  chord: ChordEvent,
  key: NoteName,
  scale: ScaleType,
  voicingOctave?: number,
): number[] {
  const baseOctave = voicingOctave ?? 4;
  const modeForRoot = chord.borrowed ?? scale;

  const rootMidi = scaleDegreeToMidi(chord.scaleDegree, 0, 0, key, modeForRoot, baseOctave);

  const offsets = chordToneOffsetsFromRoot(chord);
  if (offsets.length === 0) {
    return [clampMidi(rootMidi)];
  }

  // Close voicing: stack chord tones upward from the root within one octave (no gap > 12 from root to top).
  const rootPc = rootMidi % 12;
  const base = rootMidi - rootPc;
  const midis = offsets.map((semitones) => base + rootPc + semitones);

  const sorted = [...midis].sort((a, b) => a - b);
  const maxInv = Math.min(3, sorted.length - 1);
  const inversion = Math.min(chord.inversion, maxInv);

  return applyInversion(sorted, inversion).map(clampMidi);
}

/** Semitone distance upward from scale degree `from` to `to` within one octave. */
function semitoneUp(intervals: number[], fromIdx: number, toIdx: number): number {
  const from = intervals[fromIdx];
  const to = intervals[toIdx];
  let diff = to - from;
  if (diff < 0) {
    diff += 12;
  }
  return diff;
}

function classifyTriad(third: number, fifth: number): ChordQuality {
  const isMajorThird = third === 4;
  const isMinorThird = third === 3;
  const isDimThird = third === 3;
  const isAugThird = third === 4;

  const isPerfectFifth = fifth === 7;
  const isDimFifth = fifth === 6;
  const isAugFifth = fifth === 8;

  if (isMajorThird && isPerfectFifth) {
    return 'major';
  }
  if (isMinorThird && isPerfectFifth) {
    return 'minor';
  }
  if (isDimThird && isDimFifth) {
    return 'diminished';
  }
  if (isAugThird && isAugFifth) {
    return 'augmented';
  }

  // Extremely rare / exotic spellings in our scales — pick closest tertian label.
  if (third <= 3 && fifth <= 6) {
    return 'diminished';
  }
  if (third >= 4 && fifth >= 8) {
    return 'augmented';
  }
  return third === 4 ? 'major' : 'minor';
}

function classifySeventhChord(triad: ChordQuality, seventh: number): SeventhType {
  if (triad === 'diminished') {
    if (seventh === 9) {
      return 'dim7';
    }
    return 'min7b5';
  }

  if (triad === 'augmented') {
    // Augmented major seventh (rare diatonic) — not in union; treat as maj7 flavor.
    if (seventh === 11) {
      return 'maj7';
    }
    if (seventh === 10) {
      return 'dom7';
    }
    return 'maj7';
  }

  if (triad === 'major') {
    if (seventh === 11) {
      return 'maj7';
    }
    if (seventh === 10) {
      return 'dom7';
    }
    // Fallback if scale produces an exotic seventh
    return seventh >= 11 ? 'maj7' : 'dom7';
  }

  // minor triad
  if (seventh === 10) {
    return 'min7';
  }
  if (seventh === 11) {
    return 'maj7';
  }
  return 'min7';
}

/**
 * Pitch classes (semitones above root, 0–11) for close voicing, sorted ascending.
 * Honors explicit quality, seventh, suspension, and addition from the chord event.
 * Exported for guide-tone scale-degree mapping (TASK-1A.6).
 */
export function chordToneOffsetsFromRoot(chord: ChordEvent): number[] {
  const { quality, seventh, suspension, addition } = chord;
  const pcs = new Set<number>();

  if (suspension !== 'none') {
    pcs.add(0);
    pcs.add(suspension === 'sus2' ? 2 : 5);
    pcs.add(7);
    if (seventh !== 'none') {
      pcs.add(susSeventhOffset(seventh));
    }
  } else if (seventh === 'none') {
    pcs.add(0);
    pcs.add(triadThirdOffset(quality));
    pcs.add(triadFifthOffset(quality));
  } else {
    addSeventhChordOffsets(pcs, quality, seventh);
  }

  if (addition === 'add9') {
    pcs.add(2);
  } else if (addition === 'add11') {
    pcs.add(5);
  } else if (addition === 'add13') {
    pcs.add(9);
  }

  return [...pcs].sort((a, b) => a - b);
}

function susSeventhOffset(seventh: SeventhType): number {
  if (seventh === 'maj7') {
    return 11;
  }
  // sus + min7 / dom7 / half-dim / dim7 — default to minor 7 above root for tertian sus7
  if (seventh === 'dim7') {
    return 9;
  }
  return 10;
}

/** Four-note tertian spelling from explicit quality + seventh (non-sus). */
function addSeventhChordOffsets(
  pcs: Set<number>,
  quality: ChordQuality,
  seventh: SeventhType,
): void {
  switch (seventh) {
    case 'maj7':
      pcs.add(0);
      pcs.add(triadThirdOffset(quality));
      pcs.add(triadFifthOffset(quality));
      pcs.add(11);
      break;
    case 'dom7':
      pcs.add(0);
      pcs.add(4);
      pcs.add(7);
      pcs.add(10);
      break;
    case 'min7':
      if (quality === 'major') {
        addOffsets(pcs, [0, 4, 7, 10]);
      } else if (quality === 'minor') {
        addOffsets(pcs, [0, 3, 7, 10]);
      } else if (quality === 'diminished') {
        // Half-diminished when encoded as min7 + dim — same as min7b5
        addOffsets(pcs, [0, 3, 6, 10]);
      } else {
        addOffsets(pcs, [0, 4, 8, 10]);
      }
      break;
    case 'dim7':
      addOffsets(pcs, [0, 3, 6, 9]);
      break;
    case 'min7b5':
      addOffsets(pcs, [0, 3, 6, 10]);
      break;
    default:
      break;
  }
}

function addOffsets(pcs: Set<number>, offsets: readonly number[]): void {
  for (const o of offsets) {
    pcs.add(o);
  }
}

function triadThirdOffset(q: ChordQuality): number {
  switch (q) {
    case 'major':
      return 4;
    case 'minor':
      return 3;
    case 'diminished':
      return 3;
    case 'augmented':
      return 4;
  }
}

function triadFifthOffset(q: ChordQuality): number {
  switch (q) {
    case 'major':
      return 7;
    case 'minor':
      return 7;
    case 'diminished':
      return 6;
    case 'augmented':
      return 8;
  }
}

/**
 * PAT-011: inversion N — rotate the bottom N chord tones up by one octave.
 */
function applyInversion(sortedAscending: number[], inversion: number): number[] {
  if (inversion <= 0) {
    return sortedAscending;
  }
  const n = sortedAscending.length;
  const k = Math.min(inversion, n - 1);
  const bottom = sortedAscending.slice(0, k).map((m) => m + 12);
  const rest = sortedAscending.slice(k);
  return [...rest, ...bottom].sort((a, b) => a - b);
}

function clampMidi(m: number): number {
  return Math.max(0, Math.min(127, Math.round(m)));
}
