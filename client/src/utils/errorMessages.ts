import type { ValidationError } from '@vybpad/shared';

/**
 * PAT-001: central user-visible strings for API error codes — do not scatter copies in components.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Please check your input.',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  INVALID_REFRESH_TOKEN: 'Your session expired. Please sign in again.',
  TOKEN_EXPIRED: 'Your session expired. Please sign in again.',
  UNAUTHORIZED: 'You need to sign in to continue.',
  NOT_FOUND: 'The requested item was not found.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export function getApiErrorMessage(error: unknown): string {
  if (!isRecord(error) || typeof error.code !== 'string') {
    return 'Connection lost. Please check your network and try again.';
  }

  if (error.code === 'VALIDATION_ERROR' && 'fields' in error) {
    const fields = (error as unknown as ValidationError).fields;
    const first = Object.values(fields)[0];
    if (typeof first === 'string' && first.trim()) return first;
    return ERROR_MESSAGES.VALIDATION_ERROR;
  }

  return ERROR_MESSAGES[error.code] ?? ERROR_MESSAGES.INTERNAL_ERROR;
}
