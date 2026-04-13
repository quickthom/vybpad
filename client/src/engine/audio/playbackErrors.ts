/**
 * PAT-001 — typed client-side playback errors (not API shapes).
 * User-visible strings live in {@link getPlaybackErrorMessage}; components must not surface raw exceptions.
 *
 * {@link PlaybackInitErrorCode} / {@link getPlaybackInitErrorMessage} align with INTERFACES.md `PlaybackStore`.
 */

/** INTERFACES.md — mirrors `PlaybackStore` init lifecycle. */
export type PlaybackInitStatus = 'locked' | 'initializing' | 'ready' | 'error';

/** INTERFACES.md — persisted on the store as `initErrorCode`. */
export type PlaybackInitErrorCode =
  | 'AUDIO_CONTEXT_BLOCKED'
  | 'SAMPLE_LOAD_FAILED'
  | 'ENGINE_INIT_FAILED';

const PLAYBACK_INIT_ERROR_MESSAGES: Record<PlaybackInitErrorCode, string> = {
  AUDIO_CONTEXT_BLOCKED:
    'Audio could not start. Check that sound is allowed in your browser and try again.',
  SAMPLE_LOAD_FAILED: 'Instrument samples failed to load. Check your connection and try again.',
  ENGINE_INIT_FAILED: 'The audio engine could not start. Try reloading the page.',
};

export function getPlaybackInitErrorMessage(code: PlaybackInitErrorCode): string {
  return PLAYBACK_INIT_ERROR_MESSAGES[code];
}

export const PLAYBACK_ERROR_CODES = {
  AUDIO_INIT_FAILED: 'AUDIO_INIT_FAILED',
  AUDIO_NOT_READY: 'AUDIO_NOT_READY',
  SAMPLE_LOAD_FAILED: 'SAMPLE_LOAD_FAILED',
} as const;

export type PlaybackErrorCode = (typeof PLAYBACK_ERROR_CODES)[keyof typeof PLAYBACK_ERROR_CODES];

/** Thrown from the playback engine; extends Error for `only-throw-error` / `instanceof` checks. */
export class PlaybackError extends Error {
  readonly code: PlaybackErrorCode;

  constructor(code: PlaybackErrorCode) {
    super(code);
    this.name = 'PlaybackError';
    this.code = code;
  }
}

export function isPlaybackError(value: unknown): value is PlaybackError {
  return value instanceof PlaybackError;
}

/** Maps engine/runtime errors to INTERFACES `PlaybackInitErrorCode` for the store. */
export function getPlaybackInitErrorCode(error: unknown): PlaybackInitErrorCode {
  if (isPlaybackError(error)) {
    if (error.code === PLAYBACK_ERROR_CODES.AUDIO_INIT_FAILED) {
      return 'AUDIO_CONTEXT_BLOCKED';
    }
    if (error.code === PLAYBACK_ERROR_CODES.SAMPLE_LOAD_FAILED) {
      return 'SAMPLE_LOAD_FAILED';
    }
  }
  return 'ENGINE_INIT_FAILED';
}

export function playbackError(code: PlaybackErrorCode): PlaybackError {
  return new PlaybackError(code);
}

/** PAT-001 — central user-visible strings for playback error codes. */
const PLAYBACK_ERROR_MESSAGES: Record<PlaybackErrorCode, string> = {
  [PLAYBACK_ERROR_CODES.AUDIO_INIT_FAILED]:
    'Audio could not start. Check that sound is allowed in your browser and try again.',
  [PLAYBACK_ERROR_CODES.AUDIO_NOT_READY]: 'Playback is still starting. Please wait a moment.',
  [PLAYBACK_ERROR_CODES.SAMPLE_LOAD_FAILED]:
    'Instrument samples failed to load. Check your connection and try again.',
};

export function getPlaybackErrorMessage(error: unknown): string {
  if (isPlaybackError(error) && error.code in PLAYBACK_ERROR_MESSAGES) {
    return PLAYBACK_ERROR_MESSAGES[error.code];
  }
  return PLAYBACK_ERROR_MESSAGES[PLAYBACK_ERROR_CODES.AUDIO_INIT_FAILED];
}
