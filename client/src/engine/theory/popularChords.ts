import type { ChordEvent, NoteName, ScaleDegree, ScaleType } from '@vybpad/shared';
import { getDiatonicQuality, getDiatonicSeventh } from './chords';
import { toChordName, toRomanNumeral } from './romanNumerals';

const DEFAULT_POPULAR_ENTRY_COUNT = 8;
const MIN_POPULAR_ENTRY_COUNT = 8;
const MAX_POPULAR_ENTRY_COUNT = 16;

const POPULAR_DEGREE_ORDER: Record<ScaleType, readonly ScaleDegree[]> = {
  major: [1, 5, 4, 6, 2, 3, 7],
  minor: [1, 5, 4, 6, 7, 3, 2],
  dorian: [1, 5, 4, 2, 6, 3, 7],
  phrygian: [1, 4, 3, 2, 5, 7, 6],
  lydian: [1, 4, 5, 2, 6, 3, 7],
  mixolydian: [1, 5, 4, 2, 6, 3, 7],
  locrian: [1, 5, 7, 4, 2, 6, 3],
  harmonicMinor: [1, 5, 7, 4, 6, 2, 3],
  phrygianDominant: [1, 5, 4, 2, 3, 7, 6],
} as const;

const POPULAR_SEVENTH_PRIORITY: Record<ScaleType, readonly ScaleDegree[]> = {
  major: [5, 1, 4, 2],
  minor: [5, 1, 4],
  dorian: [5, 1, 2],
  phrygian: [5, 4, 3],
  lydian: [5, 2, 1],
  mixolydian: [5, 1, 4],
  locrian: [5, 1, 7],
  harmonicMinor: [5, 1, 6],
  phrygianDominant: [5, 1, 6],
} as const;

export interface PopularChordSuggestion {
  degree: ScaleDegree;
  includeSeventh: boolean;
  roman: string;
  chordName: string;
  payload: Omit<ChordEvent, 'id' | 'beat' | 'duration'>;
}

interface PopularChordOptions {
  maxEntries?: number;
}

interface RankedEntry {
  degree: ScaleDegree;
  includeSeventh: boolean;
  rank: number;
}

function toPreviewPayload(
  degree: ScaleDegree,
  scale: ScaleType,
  includeSeventh: boolean,
): Omit<ChordEvent, 'id' | 'beat' | 'duration'> {
  return {
    scaleDegree: degree,
    quality: getDiatonicQuality(degree, scale),
    seventh: includeSeventh ? getDiatonicSeventh(degree, scale) : 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
  };
}

function normalizeEntryCount(maxEntries: number | undefined): number {
  if (maxEntries == null || Number.isNaN(maxEntries)) {
    return DEFAULT_POPULAR_ENTRY_COUNT;
  }

  const bounded = Math.max(MIN_POPULAR_ENTRY_COUNT, Math.min(MAX_POPULAR_ENTRY_COUNT, Math.floor(maxEntries)));
  return bounded > 0 ? bounded : DEFAULT_POPULAR_ENTRY_COUNT;
}

function buildRankedEntries(scale: ScaleType): RankedEntry[] {
  const order = POPULAR_DEGREE_ORDER[scale];
  const seventhPriority = POPULAR_SEVENTH_PRIORITY[scale];
  const seventhSet = new Set<ScaleDegree>(seventhPriority);

  const out: RankedEntry[] = [];
  for (let index = 0; index < order.length; index++) {
    const degree = order[index];
    const rank = index * 2;
    out.push({ degree, includeSeventh: false, rank });

    if (seventhSet.has(degree)) {
      const bonus = (seventhPriority.indexOf(degree) + 1) / 10;
      out.push({ degree, includeSeventh: true, rank: rank + bonus });
    }
  }

  return out.sort((a, b) => a.rank - b.rank);
}

/**
 * Build a deterministic, context-aware shortlist of musically useful chords for the Popular tab.
 * The sequence is stable for a given key/scale pair and bounded to a fixed default size (8).
 */
export function getPopularChords(
  key: NoteName,
  scale: ScaleType,
  options?: PopularChordOptions,
): PopularChordSuggestion[] {
  const entryCount = normalizeEntryCount(options?.maxEntries);
  const ranked = buildRankedEntries(scale).slice(0, entryCount);

  return ranked.map((entry) => {
    const payload = toPreviewPayload(entry.degree, scale, entry.includeSeventh);
    const preview: ChordEvent = {
      id: 'palette-popular-preview',
      scaleDegree: payload.scaleDegree,
      quality: payload.quality,
      seventh: payload.seventh,
      suspension: payload.suspension,
      addition: payload.addition,
      inversion: payload.inversion,
      borrowed: payload.borrowed,
      secondary: payload.secondary,
      beat: 0,
      duration: 48,
    };

    return {
      degree: entry.degree,
      includeSeventh: entry.includeSeventh,
      roman: toRomanNumeral(preview, scale),
      chordName: toChordName(preview, key, scale),
      payload,
    };
  });
}
