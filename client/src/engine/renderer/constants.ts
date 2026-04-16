/**
 * PAT-012 canvas rendering constants (1× zoom defaults). Horizontal zoom scales {@link BEAT_WIDTH}.
 */
export const BEAT_WIDTH = 40;
export const NOTE_HEIGHT = 20;
export const CHORD_AREA_HEIGHT = 40;
export const MEASURE_HEADER_HEIGHT = 24;
export const GRID_LINE_COLOR = '#E5E7EB';
export const BAR_LINE_COLOR = '#6B7280';
export const PLAYBACK_CURSOR_COLOR = '#EF4444';
export const PLAYBACK_CURSOR_WIDTH = 2;
/** UX §6 — playback highlight stroke for notes/chords sounding at `playbackTick`. */
export const PLAYBACK_HIGHLIGHT_COLOR = '#F59E0B';
export const PLAYBACK_HIGHLIGHT_LINE_WIDTH = 2;
export const SELECTION_COLOR = 'rgba(59, 130, 246, 0.2)';

/** Left gutter for piano-roll pitch labels (RA-1); multiple of 4px per UX §3. */
export const PITCH_GUTTER_WIDTH = 40;

/**
 * Diatonic rows in the melody band (Hookpad-like ladder). Kept in sync with {@link EditorCanvas}
 * staff layout — changing this requires updating the canvas height formula + QA fixtures.
 */
export const MELODY_DIATONIC_ROW_COUNT = 28;
