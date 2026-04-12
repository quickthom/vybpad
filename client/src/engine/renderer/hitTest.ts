import type { ChordEvent, NoteEvent, SongData, Viewport } from '@vybpad/shared';

/**
 * Result of {@link hitTestEditorCanvas}: which musical event (if any) sits under a viewport point.
 *
 * **Misses:** `null` when nothing is under the point.
 *
 * @remarks Builder (TASK-2.6) replaces the stub body with real spatial queries aligned with
 * `layoutChordBlock` / `computeNoteBlockRect` and renderer Z-order.
 */
export type EditorCanvasHit =
  | { kind: 'chord'; measureIndex: number; chord: ChordEvent }
  | { kind: 'note'; measureIndex: number; voiceIndex: 0 | 1 | 2 | 3; note: NoteEvent };

/**
 * Stub implementation — QA tests fail until the Builder lands hit-testing logic.
 */
export function hitTestEditorCanvas(
  _x: number,
  _y: number,
  _song: SongData,
  _viewport: Viewport,
): EditorCanvasHit | null {
  return null;
}
