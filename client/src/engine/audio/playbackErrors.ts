/**
 * PAT-001 — typed client-side playback errors (not API shapes).
 * User-visible strings live in {@link getPlaybackErrorMessage}; components must not surface raw exceptions.
 */

export const PLAYBACK_ERROR_CODES = {
  AUDIO_INIT_FAILED: 'AUDIO_INIT_FAILED',
  AUDIO_NOT_READY: 'AUDIO_NOT_READY',
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

export function playbackError(code: PlaybackErrorCode): PlaybackError {
  return new PlaybackError(code);
}

/** PAT-001 — central user-visible strings for playback error codes. */
const PLAYBACK_ERROR_MESSAGES: Record<PlaybackErrorCode, string> = {
  [PLAYBACK_ERROR_CODES.AUDIO_INIT_FAILED]:
    'Audio could not start. Check that sound is allowed in your browser and try again.',
  [PLAYBACK_ERROR_CODES.AUDIO_NOT_READY]: 'Playback is still starting. Please wait a moment.',
};

export function getPlaybackErrorMessage(error: unknown): string {
  if (isPlaybackError(error) && error.code in PLAYBACK_ERROR_MESSAGES) {
    return PLAYBACK_ERROR_MESSAGES[error.code];
  }
  return PLAYBACK_ERROR_MESSAGES[PLAYBACK_ERROR_CODES.AUDIO_INIT_FAILED];
}
