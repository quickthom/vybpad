import type { ChordEvent, NoteName, ScaleDegree, ScaleType } from '@vybpad/shared';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { getBorrowedChords, theoryEngine } from '../../engine/theory';
import { pat010DiatonicHex } from '../../engine/renderer/colorMaps';

/** INTERFACES.md — ChordPaletteProps (library row UI-W5 / RA-8). */
export type ChordLibraryTabId = 'magic' | 'popular' | 'search' | 'progressions' | 'bassSets';

export interface ChordPaletteProps {
  currentKey: NoteName;
  currentScale: ScaleType;
  onChordSelect: (chord: Omit<ChordEvent, 'id' | 'beat' | 'duration'>) => void;
  mode: 'diatonic' | 'borrowed' | 'secondary' | 'search';
  /** UI-W5 — discovery row; omitted → internal default `"magic"`. */
  libraryTab?: ChordLibraryTabId;
  onLibraryTabChange?: (tab: ChordLibraryTabId) => void;
  /**
   * UI-W9 (RA-19) — parent resets browsing mode + library tab; ChordPalette clears parallel borrowed
   * source + search filter. Omitted when palette is standalone (tests).
   */
  onBrowseDefaultsReset?: () => void;
}

export type SecondaryChordInspectorProps = {
  /** Selected chord block, if any. */
  chord: ChordEvent | null;
  romanLabel: string;
  onCycle: () => void;
  onClear: () => void;
};

/**
 * TASK-5.3 — Minimal left-rail inspector (UX §7): cycle / clear mirror the `d` key and use the same
 * `ChordEditAction` path as the keyboard for undo consistency.
 */
export function SecondaryChordInspector(props: SecondaryChordInspectorProps): ReactElement {
  const { chord, romanLabel, onCycle, onClear } = props;
  const hasChord = chord != null;

  return (
    <section
      className="flex flex-col gap-3 border-b border-[var(--color-border,#E5E7EB)] px-4 py-3"
      aria-label="Secondary chords"
    >
      <h3 className="text-base font-semibold text-[var(--color-text-primary,#111827)]">Applied chords</h3>
      <p className="text-sm text-[var(--color-text-secondary,#4B5563)]">
        Press <kbd className="rounded bg-[var(--color-surface-muted,#F9FAFB)] px-1.5 py-0.5 font-mono text-xs">d</kbd> with
        a chord selected to cycle legal V/x, viio/x, and IV/x slots (see getSecondaryCycleSequence).
      </p>
      {hasChord ? (
        <div className="rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted,#9CA3AF)]">
            Roman
          </p>
          <p className="font-mono text-sm text-[var(--color-text-primary,#111827)]" aria-live="polite">
            {romanLabel}
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!hasChord}
          onClick={onCycle}
          className="inline-flex h-8 min-h-8 items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-4 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none transition hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          Cycle secondary (d)
        </button>
        <button
          type="button"
          disabled={!hasChord || chord?.secondary == null}
          onClick={onClear}
          className="inline-flex h-8 min-h-8 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          Clear to diatonic
        </button>
      </div>
    </section>
  );
}

const DIATONIC_DEGREES = [1, 2, 3, 4, 5, 6, 7] as const satisfies readonly ScaleDegree[];

type SearchModeRow = {
  degree: ScaleDegree;
  roman: string;
  chordName: string;
  payload: Omit<ChordEvent, 'id' | 'beat' | 'duration'>;
};

const ALL_SCALE_TYPES = [
  'major',
  'minor',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'locrian',
  'harmonicMinor',
  'phrygianDominant',
] as const satisfies readonly ScaleType[];

const LIBRARY_TAB_IDS = ['magic', 'popular', 'search', 'progressions', 'bassSets'] as const satisfies readonly ChordLibraryTabId[];

const LIBRARY_TAB_LABEL: Record<ChordLibraryTabId, string> = {
  magic: 'Magic',
  popular: 'Popular',
  search: 'Search',
  progressions: 'Progressions',
  bassSets: 'Bass Sets',
};

function parallelBorrowOptions(homeScale: ScaleType): ScaleType[] {
  return ALL_SCALE_TYPES.filter((s) => s !== homeScale);
}

function defaultBorrowedSource(homeScale: ScaleType): ScaleType {
  if (homeScale === 'major') return 'minor';
  if (homeScale === 'minor') return 'major';
  const opts = parallelBorrowOptions(homeScale);
  return opts[0] ?? 'major';
}

const BORROWED_SCALE_LABEL: Record<ScaleType, string> = {
  major: 'Major',
  minor: 'Natural minor',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  locrian: 'Locrian',
  harmonicMinor: 'Harmonic minor',
  phrygianDominant: 'Phrygian dominant',
};

/** UI-W9 — primary palette title: "Chords in C major", "Chords in D dorian", etc. */
function scaleTypeHeadingPhrase(scale: ScaleType): string {
  const map: Record<ScaleType, string> = {
    major: 'major',
    minor: 'minor',
    dorian: 'dorian',
    phrygian: 'phrygian',
    lydian: 'lydian',
    mixolydian: 'mixolydian',
    locrian: 'locrian',
    harmonicMinor: 'harmonic minor',
    phrygianDominant: 'phrygian dominant',
  };
  return map[scale];
}

function diatonicSelectPayload(degree: ScaleDegree, scale: ScaleType): Omit<ChordEvent, 'id' | 'beat' | 'duration'> {
  return {
    scaleDegree: degree,
    quality: theoryEngine.getDiatonicQuality(degree, scale),
    seventh: theoryEngine.getDiatonicSeventh(degree, scale),
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
  };
}

function buildSearchRows(currentKey: NoteName, currentScale: ScaleType): SearchModeRow[] {
  return DIATONIC_DEGREES.map((deg) => {
    const payload = diatonicSelectPayload(deg, currentScale);
    const preview: ChordEvent = {
      id: 'palette-preview',
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
      degree: deg,
      roman: theoryEngine.toRomanNumeral(preview, currentScale),
      chordName: theoryEngine.toChordName(preview, currentKey, currentScale),
      payload,
    };
  });
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Left-panel chord palette (UX §7) with discovery library tabs (UI-W5 / RA-8).
 */
export function ChordPalette(props: ChordPaletteProps): ReactElement {
  const { currentKey, currentScale, onChordSelect, mode } = props;
  const { libraryTab: libraryTabProp, onLibraryTabChange, onBrowseDefaultsReset } = props;

  const [internalLibraryTab, setInternalLibraryTab] = useState<ChordLibraryTabId>('magic');
  const isLibraryControlled = libraryTabProp !== undefined;
  const libraryTab = libraryTabProp ?? internalLibraryTab;

  const setLibraryTab = (next: ChordLibraryTabId): void => {
    onLibraryTabChange?.(next);
    if (!isLibraryControlled) {
      setInternalLibraryTab(next);
    }
  };

  const borrowOptions = useMemo(() => parallelBorrowOptions(currentScale), [currentScale]);

  const [borrowedSource, setBorrowedSource] = useState<ScaleType>(() => defaultBorrowedSource(currentScale));

  const [chordSearchFilter, setChordSearchFilter] = useState('');

  const searchRows = useMemo(() => buildSearchRows(currentKey, currentScale), [currentKey, currentScale]);
  const normalizedSearch = normalizeSearchText(chordSearchFilter);
  const filteredSearchRows = useMemo(() => {
    // Keep search semantics case-insensitive with trimmed input; empty queries show all diatonic rows.
    if (!normalizedSearch) {
      return searchRows;
    }

    return searchRows.filter((row) => {
      return row.roman.toLowerCase().includes(normalizedSearch) || row.chordName.toLowerCase().includes(normalizedSearch);
    });
  }, [searchRows, normalizedSearch]);

  useEffect(() => {
    setBorrowedSource((prev) =>
      borrowOptions.includes(prev) ? prev : defaultBorrowedSource(currentScale),
    );
  }, [borrowOptions, currentScale]);

  const handleBrowseDefaultsReset = (): void => {
    onBrowseDefaultsReset?.();
    setLibraryTab('magic');
    setBorrowedSource(defaultBorrowedSource(currentScale));
    setChordSearchFilter('');
  };

  const borrowedRows = useMemo(
    () => getBorrowedChords(currentScale, borrowedSource),
    [borrowedSource, currentScale],
  );

  const modeSubtitle =
    mode === 'diatonic'
      ? 'diatonic'
      : mode === 'borrowed'
        ? 'borrowed'
        : mode === 'secondary'
          ? 'secondary'
          : 'search';

  const tabStrip = (
    <div
      role="tablist"
      aria-label="Chord library"
      className="mt-3 flex flex-wrap gap-1 border-b border-[var(--color-border,#E5E7EB)] pb-2"
    >
      {LIBRARY_TAB_IDS.map((id) => {
        const selected = libraryTab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            id={`chord-palette-lib-tab-${id}`}
            onClick={() => setLibraryTab(id)}
            className={
              selected
                ? 'inline-flex min-h-9 shrink-0 items-center rounded-md bg-[var(--color-surface,#FFFFFF)] px-2.5 text-xs font-medium text-[var(--color-text-primary,#111827)] shadow-sm outline-none ring-1 ring-[var(--color-border-strong,#D1D5DB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
                : 'inline-flex min-h-9 shrink-0 items-center rounded-md px-2.5 text-xs font-medium text-[var(--color-text-secondary,#4B5563)] outline-none hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2'
            }
          >
            {LIBRARY_TAB_LABEL[id]}
          </button>
        );
      })}
    </div>
  );

  const magicTabContent = (): ReactElement => {
    if (mode === 'borrowed') {
      return (
        <>
          <button
            type="button"
            data-testid="chord-palette-magic-interactive"
            className="mb-3 inline-flex min-h-8 w-full items-center justify-center rounded-lg border border-dashed border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none hover:bg-[var(--color-surface,#FFFFFF)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            onClick={() => {
              const first = borrowedRows[0];
              if (!first) {
                onChordSelect(diatonicSelectPayload(1, currentScale));
                return;
              }
              onChordSelect({
                scaleDegree: first.scaleDegree,
                quality: first.borrowedQuality,
                seventh: first.borrowedSeventh,
                suspension: 'none',
                addition: 'none',
                inversion: 0,
                borrowed: borrowedSource,
                secondary: null,
              });
            }}
          >
            Magic fill (first different chord)
          </button>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="chord-palette-borrowed-scale"
              className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted,#9CA3AF)]"
            >
              Parallel borrowed scale
            </label>
            <select
              id="chord-palette-borrowed-scale"
              data-testid="chord-palette-borrowed-scale"
              className="min-h-8 w-full rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 py-2 text-sm text-[var(--color-text-primary,#111827)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
              aria-label="Borrowed scale"
              value={borrowedSource}
              onChange={(e) => setBorrowedSource(e.target.value as ScaleType)}
            >
              {borrowOptions.map((s) => (
                <option key={s} value={s}>
                  {BORROWED_SCALE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          {borrowedRows.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-text-secondary,#4B5563)]">
              No chords differ between {currentScale} and this parallel mode for this key.
            </p>
          ) : (
            <div
              className="mt-4 flex flex-col gap-2"
              role="group"
              aria-label="Borrowed scale degrees"
            >
              {borrowedRows.map((row) => {
                const deg = row.scaleDegree;
                const fill = pat010DiatonicHex(deg);
                const preview: ChordEvent = {
                  id: 'palette-preview',
                  scaleDegree: deg,
                  quality: row.borrowedQuality,
                  seventh: row.borrowedSeventh,
                  suspension: 'none',
                  addition: 'none',
                  inversion: 0,
                  borrowed: borrowedSource,
                  secondary: null,
                  beat: 0,
                  duration: 48,
                };
                const roman = theoryEngine.toRomanNumeral(preview, currentScale);
                const name = theoryEngine.toChordName(preview, currentKey, currentScale);
                return (
                  <button
                    key={`${borrowedSource}-${deg}`}
                    type="button"
                    data-testid={`chord-palette-borrowed-degree-${deg}`}
                    tabIndex={0}
                    className="flex min-h-10 w-full flex-row items-stretch gap-3 rounded-lg border border-[var(--color-border-strong,#D1D5DB)] text-left outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${fill}33 0, ${fill}33 4px, transparent 4px), linear-gradient(var(--color-surface,#FFFFFF), var(--color-surface,#FFFFFF))`,
                    }}
                    aria-label={`Add borrowed chord, degree ${deg}, ${roman}`}
                    onClick={() =>
                      onChordSelect({
                        scaleDegree: deg,
                        quality: row.borrowedQuality,
                        seventh: row.borrowedSeventh,
                        suspension: 'none',
                        addition: 'none',
                        inversion: 0,
                        borrowed: borrowedSource,
                        secondary: null,
                      })
                    }
                  >
                    <span className="sr-only">{deg}</span>
                    <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
                      <span className="text-sm font-semibold text-[var(--color-text-primary,#111827)]">{roman}</span>
                      <span className="mt-0.5 text-xs font-normal text-[var(--color-text-secondary,#4B5563)]">{name}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      );
    }

    if (mode === 'diatonic') {
      return (
        <>
          <button
            type="button"
            data-testid="chord-palette-magic-interactive"
            className="mb-3 inline-flex min-h-8 w-full items-center justify-center rounded-lg border border-dashed border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none hover:bg-[var(--color-surface,#FFFFFF)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            onClick={() => onChordSelect(diatonicSelectPayload(1, currentScale))}
          >
            Magic: tonic chord
          </button>
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-0 flex-row gap-2" role="group" aria-label="Diatonic scale degrees">
              {DIATONIC_DEGREES.map((deg) => {
                const fill = pat010DiatonicHex(deg);
                const preview: ChordEvent = {
                  id: 'palette-preview',
                  scaleDegree: deg,
                  quality: theoryEngine.getDiatonicQuality(deg, currentScale),
                  seventh: theoryEngine.getDiatonicSeventh(deg, currentScale),
                  suspension: 'none',
                  addition: 'none',
                  inversion: 0,
                  borrowed: null,
                  secondary: null,
                  beat: 0,
                  duration: 48,
                };
                const roman = theoryEngine.toRomanNumeral(preview, currentScale);
                const name = theoryEngine.toChordName(preview, currentKey, currentScale);
                return (
                  <button
                    key={deg}
                    type="button"
                    data-testid={`chord-palette-degree-${deg}`}
                    tabIndex={0}
                    className="flex min-h-12 min-w-[74px] shrink-0 flex-col items-start justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] px-2 py-2 text-left outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${fill}33 0, ${fill}33 4px, transparent 4px), linear-gradient(var(--color-surface,#FFFFFF), var(--color-surface,#FFFFFF))`,
                    }}
                    aria-label={`Add diatonic chord, degree ${deg}, ${roman}`}
                    onClick={() => onChordSelect(diatonicSelectPayload(deg, currentScale))}
                  >
                    <span className="text-sm font-semibold leading-none text-[var(--color-text-primary,#111827)]">{roman}</span>
                    <span className="mt-1 text-[10px] leading-none font-normal text-[var(--color-text-secondary,#4B5563)]">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <p className="text-sm text-[var(--color-text-secondary,#4B5563)]">
          {mode === 'secondary' && 'Secondary dominants — coming later.'}
          {mode === 'search' && 'Chord search — coming later.'}
        </p>
        <button
          type="button"
          data-testid="chord-palette-magic-interactive"
          className="mt-3 inline-flex min-h-8 w-full items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface-muted,#F9FAFB)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none hover:bg-[var(--color-surface,#FFFFFF)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          onClick={() => onChordSelect(diatonicSelectPayload(1, currentScale))}
        >
          Preview I
        </button>
      </>
    );
  };

  const applyProgressionDegrees = (degrees: readonly ScaleDegree[]): void => {
    for (const deg of degrees) {
      onChordSelect(diatonicSelectPayload(deg, currentScale));
    }
  };

  const libraryPanel = (): ReactElement => {
    switch (libraryTab) {
      case 'magic':
        return magicTabContent();
      case 'popular':
        return (
          <button
            type="button"
            data-testid="chord-palette-popular-interactive"
            className="inline-flex min-h-8 w-full items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-3 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            onClick={() => onChordSelect(diatonicSelectPayload(5, currentScale))}
          >
            Popular: V chord
          </button>
        );
      case 'search':
        return (
          <div className="flex flex-col gap-2">
            <label htmlFor="chord-palette-search-filter" className="text-xs font-medium text-[var(--color-text-secondary,#4B5563)]">
              Filter chords
            </label>
            <input
              id="chord-palette-search-filter"
              data-testid="chord-palette-search-filter"
              type="search"
              aria-label="Filter chords"
              aria-controls="chord-palette-search-results"
              aria-autocomplete="list"
              value={chordSearchFilter}
              onChange={(e) => setChordSearchFilter(e.target.value)}
              placeholder="Type to filter…"
              className="min-h-10 w-full rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 py-2 text-sm text-[var(--color-text-primary,#111827)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            />
            <ul
              id="chord-palette-search-results"
              role="list"
              aria-label="Search results"
              className="mt-1 flex flex-col gap-2"
            >
              {filteredSearchRows.length === 0 ? (
                <li className="text-sm text-[var(--color-text-muted,#9CA3AF)]" role="listitem">
                  No chords match your query.
                </li>
              ) : (
                filteredSearchRows.map((row) => {
                  const fill = pat010DiatonicHex(row.degree);
                  return (
                    <li key={row.degree} role="listitem" className="w-full">
                      <button
                        type="button"
                        data-testid={`chord-palette-search-degree-${row.degree}`}
                        className="flex min-h-10 w-full flex-col items-start justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] px-3 py-2 text-left outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
                        style={{
                          backgroundImage: `linear-gradient(90deg, ${fill}33 0, ${fill}33 4px, transparent 4px), linear-gradient(var(--color-surface,#FFFFFF), var(--color-surface,#FFFFFF))`,
                        }}
                        aria-label={`Add search chord, degree ${row.degree}, ${row.roman}, ${row.chordName}`}
                        onClick={() => onChordSelect(row.payload)}
                      >
                        <span className="text-sm font-semibold leading-none text-[var(--color-text-primary,#111827)]">{row.roman}</span>
                        <span className="mt-0.5 text-xs leading-none font-normal text-[var(--color-text-secondary,#4B5563)]">{row.chordName}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        );
      case 'progressions':
        return (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[var(--color-text-muted,#9CA3AF)]">Apply a preset progression to the editor insertion point.</p>
            <button
              type="button"
              data-testid="chord-palette-progression-preset-a"
              className="inline-flex min-h-8 w-full items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
              onClick={() => applyProgressionDegrees([1, 4, 5, 1])}
            >
              Preset A — I–IV–V–I
            </button>
            <button
              type="button"
              data-testid="chord-palette-progression-preset-b"
              className="inline-flex min-h-8 w-full items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
              onClick={() => applyProgressionDegrees([2, 5, 1, 6])}
            >
              Preset B — ii–V–I–vi
            </button>
          </div>
        );
      case 'bassSets':
        return (
          <button
            type="button"
            data-testid="chord-palette-bass-sets-interactive"
            className="inline-flex min-h-8 w-full items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
            onClick={() => onChordSelect(diatonicSelectPayload(5, currentScale))}
          >
            Bass set: roots on 1 & 5
          </button>
        );
    }
  };

  const headingText = `Chords in ${currentKey} ${scaleTypeHeadingPhrase(currentScale)}`;

  return (
    <div
      data-testid="chord-palette-root"
      role="region"
      aria-label="Chord palette"
      className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col bg-[var(--color-surface,#FFFFFF)] px-4 py-3"
    >
      <div className="flex min-w-0 flex-row items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-[var(--color-text-primary,#111827)]">
          {headingText}
        </h3>
        <button
          type="button"
          onClick={handleBrowseDefaultsReset}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
        >
          Reset
        </button>
      </div>
      <p className="mt-1 text-xs capitalize text-[var(--color-text-muted,#9CA3AF)]">{modeSubtitle} mode</p>
      {tabStrip}
      <div
        role="tabpanel"
        className="mt-3 min-h-0 flex-1"
        aria-labelledby={`chord-palette-lib-tab-${libraryTab}`}
      >
        {libraryPanel()}
      </div>
    </div>
  );
}
