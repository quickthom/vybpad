import type { ChordEvent, NoteEvent, SongData, Viewport } from '@vybpad/shared';

import { MELODY_DIATONIC_ROW_COUNT, NOTE_HEIGHT } from './constants';
import { layoutChordBlock } from './chordBlocks';
import { computeNoteBlockRect } from './noteBlocks';
import type { VoicePitchRange } from './voicePitchRange';

/**
 * Result of {@link hitTestEditorCanvas}: which musical event (if any) sits under a viewport point.
 *
 * **Misses:** {@link hitTestEditorCanvas} returns `null` when the point is outside all chord/note
 * axis-aligned bounds (measure header, grid gaps, padding between blocks, or empty staff rows).
 * Callers may treat `null` as “no target”.
 */
export type EditorCanvasHit =
  | { kind: 'chord'; measureIndex: number; chord: ChordEvent }
  | { kind: 'note'; measureIndex: number; voiceIndex: 0 | 1 | 2 | 3; note: NoteEvent };

/**
 * Axis-aligned hit test in **viewport coordinates** (same space as {@link layout.absoluteTickToViewportX}
 * and {@link noteBlocks.computeNoteBlockRect}). Uses the same bounding boxes as the canvas renderers
 * (PAT-012 dimensions); rounded corners are not modeled — the full rect matches `layoutChordBlock` /
 * `computeNoteBlockRect`.
 */
function pointInBlockRect(
  px: number,
  py: number,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  // Half-open intervals so adjacent blocks do not double-hit shared edges.
  return px >= rect.x && px < rect.x + rect.width && py >= rect.y && py < rect.y + rect.height;
}

/**
 * Chord-strip Z-order (matches {@link chordBlocks.drawChordBlocks}):
 * ascending `measureIndex` from `viewport.startMeasure`, and within each measure ascending order in
 * `measure.chords`. Later entries are painted later and therefore **on top**. Hit-testing walks that
 * order **in reverse** and returns the first (topmost) match.
 */
function hitChordTopmost(
  x: number,
  y: number,
  song: SongData,
  viewport: Viewport,
  melodyRowHeight: number,
  melodyRowCount: number = MELODY_DIATONIC_ROW_COUNT,
): EditorCanvasHit | null {
  const start = viewport.startMeasure;
  const end = Math.min(start + viewport.measureCount, song.measures.length);
  for (let mi = end - 1; mi >= start; mi--) {
    const measure = song.measures[mi];
    if (!measure) {
      continue;
    }
    const chords = measure.chords;
    for (let ci = chords.length - 1; ci >= 0; ci--) {
      const chord = chords[ci];
      if (!chord) {
        continue;
      }
      const rect = layoutChordBlock(chord, mi, song, viewport, melodyRowHeight, melodyRowCount);
      if (pointInBlockRect(x, y, rect)) {
        return { kind: 'chord', measureIndex: mi, chord };
      }
    }
  }
  return null;
}

/**
 * Note-staff Z-order (matches {@link noteBlocks.drawNoteBlocks}):
 * ascending measure index, then voices **0 → 3**, then each voice’s note array in list order.
 * Higher voice index and later list entries are painted on top. Hit-testing reverses that walk
 * (measures backward, voices 3→0, notes backward in each list) and returns the first match.
 */
function hitNoteTopmost(
  x: number,
  y: number,
  song: SongData,
  viewport: Viewport,
  melodyRowHeight: number,
  melodyVoiceVisible: readonly [boolean, boolean, boolean, boolean] = [true, true, true, true],
  melodyVoicePitchRange?: Pick<VoicePitchRange, 'minPitch'>,
): EditorCanvasHit | null {
  const start = viewport.startMeasure;
  const end = Math.min(start + viewport.measureCount, song.measures.length);
  for (let mi = end - 1; mi >= start; mi--) {
    const measure = song.measures[mi];
    if (!measure) {
      continue;
    }
    for (const v of [3, 2, 1, 0] as const) {
      if (!melodyVoiceVisible[v]) {
        continue;
      }
      const list = measure.notes[v] ?? [];
      for (let ni = list.length - 1; ni >= 0; ni--) {
        const note = list[ni];
        if (!note) {
          continue;
        }
        const rect = computeNoteBlockRect({
          song,
          viewport,
          measureIndex: mi,
          note,
          isRest: note.isRest,
          voiceIndex: v,
          melodyRowHeight,
          melodyVoicePitchRange,
        });
        if (pointInBlockRect(x, y, rect)) {
          return { kind: 'note', measureIndex: mi, voiceIndex: v, note };
        }
      }
    }
  }
  return null;
}

/**
 * Hit-test the editor main canvas: given `(x, y)` in viewport pixels, return the topmost chord or note
 * under the cursor, or `null` if none.
 *
 * Note geometry uses the same row math as {@link layout.noteRowYFromNoteEvent} via
 * {@link noteBlocks.computeNoteBlockRect}.
 *
 * **Global Z-order (matches {@link EditorCanvas} `paint`):** `drawGridBackground` → `drawNoteBlocks` →
 * `drawChordBlocks` (bottom strip) → optional `drawGuideOverlay` when guides are on. Melody and bottom
 * chord strip do not overlap; notes are tested first, then chords.
 */
export function hitTestEditorCanvas(
  x: number,
  y: number,
  song: SongData,
  viewport: Viewport,
  melodyRowHeight: number = NOTE_HEIGHT,
  melodyVoiceVisible: readonly [boolean, boolean, boolean, boolean] = [true, true, true, true],
  melodyVoicePitchRange?: Pick<VoicePitchRange, 'minPitch'>,
  melodyRowCount: number = MELODY_DIATONIC_ROW_COUNT,
): EditorCanvasHit | null {
  const noteHit = hitNoteTopmost(
    x,
    y,
    song,
    viewport,
    melodyRowHeight,
    melodyVoiceVisible,
    melodyVoicePitchRange,
  );
  if (noteHit) {
    return noteHit;
  }
  return hitChordTopmost(x, y, song, viewport, melodyRowHeight, melodyRowCount);
}
