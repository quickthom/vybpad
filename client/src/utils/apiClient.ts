import type {
  AuthError,
  AuthResponse,
  ConflictError,
  CreateProjectRequest,
  LoginRequest,
  NotFoundError,
  ProjectListResponse,
  ProjectResponse,
  RefreshResponse,
  RegisterRequest,
  ServerError,
  UpdateProjectRequest,
  ValidationError,
} from '@vybpad/shared';

/** PAT-013 — default when `VITE_API_URL` is unset (127.0.0.1 matches Playwright/e2e:devstack; avoids cross-site credentialed fetch vs `localhost`). */
const DEFAULT_API_BASE = 'http://127.0.0.1:3001';

export interface ApiClientConfig {
  getAccessToken: () => string | null;
  onAuthFailure: () => void;
  /** Called after a successful `/api/auth/refresh` so the auth store can persist the new access token before retries. */
  onAccessTokenRefreshed?: (accessToken: string) => void;
}

let config: ApiClientConfig = {
  getAccessToken: () => null,
  onAuthFailure: () => {},
};

export function configureApiClient(next: ApiClientConfig): void {
  config = next;
}

function getBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  const trimmed = (typeof raw === 'string' ? raw : '').trim();
  return trimmed.replace(/\/+$/, '') || DEFAULT_API_BASE;
}

/** Serialize concurrent refresh attempts (multiple 401s share one refresh). */
let refreshInFlight: Promise<RefreshResponse | null> | null = null;

async function refreshAccessTokenLocked(): Promise<RefreshResponse | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const res = await fetch(`${getBaseUrl()}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as RefreshResponse;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function isErrorBody(value: unknown): value is { code: string } & Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'code' in value &&
    typeof (value as { code: unknown }).code === 'string'
  );
}

function throwApiError(
  payload: ValidationError | ConflictError | AuthError | NotFoundError | ServerError,
): never {
  const err = new Error(payload.code);
  Object.assign(err, payload);
  throw err;
}

function toTypedApiError(
  status: number,
  body: unknown,
): ValidationError | ConflictError | AuthError | NotFoundError | ServerError {
  if (isErrorBody(body)) {
    switch (body.code) {
      case 'VALIDATION_ERROR':
        if ('fields' in body && typeof body.fields === 'object' && body.fields !== null) {
          return {
            code: 'VALIDATION_ERROR',
            fields: body.fields as Record<string, string>,
          };
        }
        break;
      case 'EMAIL_ALREADY_EXISTS':
        return { code: 'EMAIL_ALREADY_EXISTS' };
      case 'INVALID_CREDENTIALS':
      case 'INVALID_REFRESH_TOKEN':
      case 'TOKEN_EXPIRED':
      case 'UNAUTHORIZED':
        return { code: body.code };
      case 'NOT_FOUND':
        if ('resource' in body && typeof body.resource === 'string') {
          return { code: 'NOT_FOUND', resource: body.resource };
        }
        return { code: 'NOT_FOUND', resource: 'unknown' };
      case 'INTERNAL_ERROR':
        return {
          code: 'INTERNAL_ERROR',
          ...(typeof body.message === 'string' ? { message: body.message } : {}),
        };
      default:
        break;
    }
  }

  if (status === 404) {
    return { code: 'NOT_FOUND', resource: 'unknown' };
  }
  if (status === 401) {
    return { code: 'UNAUTHORIZED' };
  }
  return { code: 'INTERNAL_ERROR' };
}

async function parseErrorResponse(response: Response): Promise<never> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  throwApiError(toTypedApiError(response.status, body));
}

async function fetchWithOptionalTimeout(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  if (timeoutMs == null || timeoutMs <= 0) {
    return fetch(url, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('REQUEST_TIMEOUT'));
  }, timeoutMs);

  const forwardAbort = () => {
    controller.abort();
  };
  init.signal?.addEventListener('abort', forwardAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    init.signal?.removeEventListener('abort', forwardAbort);
  }
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  options: { attachBearer: boolean; retryOn401: boolean; timeoutMs?: number },
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const headers = new Headers(init.headers);
  if (init.body !== undefined && init.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let token = options.attachBearer ? config.getAccessToken() : null;

  // Cookie-only session (reload): avoid a bearer-less protected hop that always 401s — the browser
  // still logs that failure even when we retry after refresh (Playwright `console` error).
  const proactiveRefresh =
    options.attachBearer &&
    !token &&
    options.retryOn401 &&
    path !== '/api/auth/logout';

  if (proactiveRefresh) {
    const refreshed = await refreshAccessTokenLocked();
    if (refreshed) {
      config.onAccessTokenRefreshed?.(refreshed.accessToken);
      token = refreshed.accessToken;
    }
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const exec = async (bearerOverride: string | null): Promise<Response> => {
    const h = new Headers(headers);
    if (options.attachBearer) {
      if (bearerOverride) {
        h.set('Authorization', `Bearer ${bearerOverride}`);
      } else if (!token) {
        h.delete('Authorization');
      }
    }
    return fetchWithOptionalTimeout(url, { ...init, headers: h, credentials: 'include' }, options.timeoutMs);
  };

  let response = await exec(null);

  if (response.status === 401 && options.retryOn401) {
    const refreshed = await refreshAccessTokenLocked();
    if (!refreshed) {
      config.onAuthFailure();
      await parseErrorResponse(response);
    } else {
      config.onAccessTokenRefreshed?.(refreshed.accessToken);
      response = await exec(refreshed.accessToken);
      if (response.status === 401) {
        config.onAuthFailure();
        await parseErrorResponse(response);
      }
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    await parseErrorResponse(response);
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throwApiError({ code: 'INTERNAL_ERROR' });
  }
}

export const authApi = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    return requestJson<AuthResponse>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(data) },
      { attachBearer: false, retryOn401: false },
    );
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    return requestJson<AuthResponse>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify(data) },
      { attachBearer: false, retryOn401: false },
    );
  },

  async refresh(): Promise<RefreshResponse> {
    const data = await refreshAccessTokenLocked();
    if (!data) {
      config.onAuthFailure();
      throwApiError({ code: 'INVALID_REFRESH_TOKEN' });
    }
    config.onAccessTokenRefreshed?.(data.accessToken);
    return data;
  },

  async logout(): Promise<void> {
    return requestJson<void>(
      '/api/auth/logout',
      { method: 'POST', body: '{}' },
      { attachBearer: true, retryOn401: true },
    );
  },
};

export const projectsApi = {
  async list(): Promise<ProjectListResponse> {
    return requestJson<ProjectListResponse>(
      '/api/projects',
      { method: 'GET' },
      { attachBearer: true, retryOn401: true },
    );
  },

  async create(data: CreateProjectRequest): Promise<ProjectResponse> {
    return requestJson<ProjectResponse>(
      '/api/projects',
      { method: 'POST', body: JSON.stringify(data) },
      { attachBearer: true, retryOn401: true },
    );
  },

  async get(id: string): Promise<ProjectResponse> {
    return requestJson<ProjectResponse>(
      `/api/projects/${encodeURIComponent(id)}`,
      { method: 'GET' },
      { attachBearer: true, retryOn401: true },
    );
  },

  async update(id: string, data: UpdateProjectRequest): Promise<ProjectResponse> {
    return requestJson<ProjectResponse>(
      `/api/projects/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(data) },
      // Hung PUTs would otherwise leave autosave pending until the browser gives up; CI benefits from a bounded wait + PAT-001 transport retry.
      { attachBearer: true, retryOn401: true, timeoutMs: 90_000 },
    );
  },

  async delete(id: string): Promise<void> {
    return requestJson<void>(
      `/api/projects/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      { attachBearer: true, retryOn401: true },
    );
  },
};
