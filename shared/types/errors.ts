export interface ValidationError {
  code: "VALIDATION_ERROR";
  fields: Record<string, string>; // field name → error message
}

export interface ConflictError {
  code: "EMAIL_ALREADY_EXISTS";
}

export interface AuthError {
  code:
    | "INVALID_CREDENTIALS"
    | "INVALID_REFRESH_TOKEN"
    | "TOKEN_EXPIRED"
    | "UNAUTHORIZED";
}

export interface NotFoundError {
  code: "NOT_FOUND";
  resource: string; // e.g., "project"
}

export interface ServerError {
  code: "INTERNAL_ERROR";
  message?: string; // only in development
}
