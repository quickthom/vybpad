/*
 * QA COVERAGE PLAN — TASK-1B.5
 *
 * Criterion 1–4 (authApi register/login/refresh/logout): happy paths, error shapes, correct URLs/methods/bodies.
 * Criterion 5–9 (projects CRUD): happy paths, 404/400 typed errors, DELETE/204.
 * Criterion 10: Authorization Bearer from getter on protected routes; absent when token null.
 * Criterion 11–13: single refresh on 401, retry original request, no retry on other statuses.
 * Criterion 12: onAuthFailure when refresh fails or second 401 after refresh.
 * Criterion 14: rejects with typed error objects (toMatchObject code/fields), not Response.
 * Criterion 15: VITE_API_URL base URL; default 127.0.0.1 when unset/blank.
 * Criterion 16: all HTTP via global fetch (mocked; no Axios).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SongData } from '@vybpad/shared';

const minimalSong: SongData = {
  version: '1.0',
  metadata: {
    title: 'T',
    key: 'C',
    scale: 'major',
    tempo: 120,
    meter: { numerator: 4, denominator: 4 },
  },
  measures: [
    {
      id: 'measure-1',
      chords: [],
      notes: [[], [], [], []],
    },
  ],
  bandConfig: {
    tracks: [
      { role: 'melody1', instrument: 'piano', volume: 0.8, mute: false, octave: 0 },
      { role: 'melody2', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
      { role: 'melody3', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
      { role: 'melody4', instrument: 'piano', volume: 0.6, mute: true, octave: 0 },
      { role: 'harmony', instrument: 'piano', volume: 0.5, mute: false, octave: 0 },
      { role: 'bass', instrument: 'piano', volume: 0.5, mute: false, octave: -1 },
      { role: 'drums', instrument: 'piano', volume: 0.0, mute: true, octave: 0 },
    ],
  },
};

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as HeadersInit) },
  });
}

function authHeader(init: RequestInit | undefined): string | null {
  const h = init?.headers;
  if (!h) return null;
  if (h instanceof Headers) return h.get('Authorization');
  const record = h as Record<string, string>;
  return record.Authorization ?? record.authorization ?? null;
}

type ApiModule = typeof import('../../../src/utils/apiClient');

let authApi: ApiModule['authApi'];
let projectsApi: ApiModule['projectsApi'];
let configureApiClient: ApiModule['configureApiClient'];

let accessToken: string | null;
let onAuthFailure: ReturnType<typeof vi.fn>;
let onAccessTokenRefreshed: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', 'http://api.test');
  vi.stubGlobal('fetch', vi.fn());

  accessToken = 'test-access-token';
  onAuthFailure = vi.fn();
  onAccessTokenRefreshed = vi.fn();

  const m = await import('../../../src/utils/apiClient');
  authApi = m.authApi;
  projectsApi = m.projectsApi;
  configureApiClient = m.configureApiClient;

  configureApiClient({
    getAccessToken: () => accessToken,
    onAuthFailure,
    onAccessTokenRefreshed,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('apiClient — authApi.register', () => {
  describe('happy path', () => {
    it('sends POST to /api/auth/register with JSON body and returns AuthResponse shape', async () => {
      const payload = {
        user: {
          id: 'u1',
          email: 'a@b.com',
          displayName: 'Ada',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        accessToken: 'jwt-1',
      };
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, { status: 201 }));

      const data = await authApi.register({
        email: 'a@b.com',
        password: 'password12',
        displayName: 'Ada',
      });

      expect(data).toEqual(payload);
      expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/auth/register');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).method).toBe('POST');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body).toBe(
        JSON.stringify({ email: 'a@b.com', password: 'password12', displayName: 'Ada' }),
      );
      expect(authHeader(vi.mocked(fetch).mock.calls[0]![1] as RequestInit)).toBeNull();
    });
  });

  describe('error handling', () => {
    it('throws ValidationError shape when server returns 400 with VALIDATION_ERROR body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse(
          { code: 'VALIDATION_ERROR', fields: { email: 'Invalid email' } },
          { status: 400 },
        ),
      );

      await expect(
        authApi.register({ email: 'x', password: 'password12', displayName: 'Ada' }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: { email: 'Invalid email' },
      });
    });
  });
});

describe('apiClient — authApi.login', () => {
  describe('happy path', () => {
    it('sends POST to /api/auth/login with JSON body and returns AuthResponse shape', async () => {
      const payload = {
        user: {
          id: 'u1',
          email: 'a@b.com',
          displayName: 'Ada',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        accessToken: 'jwt-login',
      };
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, { status: 200 }));

      const data = await authApi.login({ email: 'a@b.com', password: 'secret1234' });

      expect(data).toEqual(payload);
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/auth/login');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).method).toBe('POST');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body).toBe(
        JSON.stringify({ email: 'a@b.com', password: 'secret1234' }),
      );
    });
  });

  describe('error handling', () => {
    it('throws AuthError INVALID_CREDENTIALS when server returns 401 with that body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ code: 'INVALID_CREDENTIALS' }, { status: 401 }),
      );

      await expect(authApi.login({ email: 'a@b.com', password: 'wrong' })).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });
  });
});

describe('apiClient — authApi.refresh', () => {
  describe('happy path', () => {
    it('sends POST to /api/auth/refresh and returns RefreshResponse', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ accessToken: 'refreshed-jwt' }, { status: 200 }),
      );

      const data = await authApi.refresh();

      expect(data).toEqual({ accessToken: 'refreshed-jwt' });
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/auth/refresh');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).method).toBe('POST');
      expect(onAccessTokenRefreshed).toHaveBeenCalledWith('refreshed-jwt');
    });
  });

  describe('error handling', () => {
    it('calls onAuthFailure and throws INVALID_REFRESH_TOKEN when refresh endpoint is not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }));

      await expect(authApi.refresh()).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
      expect(onAuthFailure).toHaveBeenCalledTimes(1);
    });
  });
});

describe('apiClient — authApi.logout', () => {
  describe('happy path', () => {
    it('sends POST to /api/auth/logout with empty JSON body and resolves void on 204', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

      await expect(authApi.logout()).resolves.toBeUndefined();

      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/auth/logout');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).method).toBe('POST');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body).toBe('{}');
      expect(authHeader(vi.mocked(fetch).mock.calls[0]![1] as RequestInit)).toBe(
        'Bearer test-access-token',
      );
    });
  });
});

describe('apiClient — projectsApi.list', () => {
  describe('happy path', () => {
    it('sends GET /api/projects and returns ProjectListResponse', async () => {
      const body: {
        projects: { id: string; name: string; createdAt: string; updatedAt: string }[];
      } = {
        projects: [
          {
            id: 'p1',
            name: 'Song 1',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
      };
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(body));

      const data = await projectsApi.list();

      expect(data).toEqual(body);
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/projects');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).method).toBe('GET');
    });
  });
});

describe('apiClient — projectsApi.create', () => {
  describe('happy path', () => {
    it('sends POST /api/projects with body and returns ProjectResponse', async () => {
      const res = {
        id: 'proj-1',
        name: 'New',
        songData: minimalSong,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(res, { status: 201 }));

      const data = await projectsApi.create({ name: 'New', songData: minimalSong });

      expect(data).toEqual(res);
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/projects');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).method).toBe('POST');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body).toBe(
        JSON.stringify({ name: 'New', songData: minimalSong }),
      );
    });
  });
});

describe('apiClient — projectsApi.get', () => {
  describe('happy path', () => {
    it('sends GET /api/projects/:id with encoded id and returns ProjectResponse', async () => {
      const id = 'abc/def';
      const res = {
        id: 'encoded-id',
        name: 'P',
        songData: minimalSong,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(res));

      const data = await projectsApi.get(id);

      expect(data).toEqual(res);
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe(
        `http://api.test/api/projects/${encodeURIComponent(id)}`,
      );
    });
  });

  describe('error handling', () => {
    it('throws NotFoundError when server returns 404 with NOT_FOUND body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ code: 'NOT_FOUND', resource: 'project' }, { status: 404 }),
      );

      await expect(projectsApi.get('missing')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        resource: 'project',
      });
    });
  });
});

describe('apiClient — projectsApi.update', () => {
  describe('happy path', () => {
    it('sends PUT /api/projects/:id with partial body and returns ProjectResponse', async () => {
      const res = {
        id: 'p1',
        name: 'Renamed',
        songData: minimalSong,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
      };
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(res));

      const data = await projectsApi.update('p1', { name: 'Renamed' });

      expect(data).toEqual(res);
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/projects/p1');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).method).toBe('PUT');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body).toBe(
        JSON.stringify({ name: 'Renamed' }),
      );
    });
  });
});

describe('apiClient — projectsApi.delete', () => {
  describe('happy path', () => {
    it('sends DELETE /api/projects/:id and resolves void on 204', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

      await expect(projectsApi.delete('p9')).resolves.toBeUndefined();
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/projects/p9');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
    });
  });
});

describe('apiClient — Authorization header (PAT-007)', () => {
  describe('happy path', () => {
    it('attaches Bearer token from getAccessToken for protected project requests', async () => {
      accessToken = 'alpha-beta-token';
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ projects: [] }));

      await projectsApi.list();

      expect(authHeader(vi.mocked(fetch).mock.calls[0]![1] as RequestInit)).toBe(
        'Bearer alpha-beta-token',
      );
    });

    it('refreshes first when getAccessToken returns null so the first project request is not a doomed 401', async () => {
      accessToken = null;
      vi.mocked(fetch)
        .mockResolvedValueOnce(jsonResponse({ accessToken: 'from-cookie-refresh' }))
        .mockResolvedValueOnce(jsonResponse({ projects: [] }));

      await projectsApi.list();

      expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/auth/refresh');
      expect(authHeader(vi.mocked(fetch).mock.calls[1]![1] as RequestInit)).toBe(
        'Bearer from-cookie-refresh',
      );
      expect(onAccessTokenRefreshed).toHaveBeenCalledWith('from-cookie-refresh');
    });
  });
});

describe('apiClient — refresh on 401 and retry', () => {
  describe('happy path', () => {
    it('refreshes once on 401 then retries the original request with new access token', async () => {
      const listBody = { projects: [] };
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'TOKEN_EXPIRED' }), { status: 401 }),
        )
        .mockResolvedValueOnce(jsonResponse({ accessToken: 'new-jwt' }))
        .mockResolvedValueOnce(jsonResponse(listBody));

      const result = await projectsApi.list();

      expect(result).toEqual(listBody);
      expect(vi.mocked(fetch).mock.calls).toHaveLength(3);
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/projects');
      expect(vi.mocked(fetch).mock.calls[1]![0]).toBe('http://api.test/api/auth/refresh');
      expect((vi.mocked(fetch).mock.calls[1]![1] as RequestInit).method).toBe('POST');
      expect(vi.mocked(fetch).mock.calls[2]![0]).toBe('http://api.test/api/projects');
      expect(authHeader(vi.mocked(fetch).mock.calls[2]![1] as RequestInit)).toBe('Bearer new-jwt');
      expect(onAccessTokenRefreshed).toHaveBeenCalledWith('new-jwt');
    });
  });

  describe('error handling', () => {
    it('calls onAuthFailure and throws when refresh fails after 401', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 401 }));

      await expect(projectsApi.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      expect(onAuthFailure).toHaveBeenCalledTimes(1);
    });

    it('calls onAuthFailure when retry after refresh still returns 401', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 }),
        )
        .mockResolvedValueOnce(jsonResponse({ accessToken: 'new-jwt' }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 }),
        );

      await expect(projectsApi.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      expect(onAuthFailure).toHaveBeenCalledTimes(1);
    });
  });
});

describe('apiClient — no retry on non-401 errors', () => {
  it('does not call refresh when GET /api/projects returns 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ code: 'NOT_FOUND', resource: 'project' }, { status: 404 }),
    );

    await expect(projectsApi.get('x')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls[0]![0]).toContain('/api/projects/');
  });

  it('does not call refresh when server returns 400', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ code: 'VALIDATION_ERROR', fields: { name: 'required' } }, { status: 400 }),
    );

    await expect(projectsApi.create({ name: '' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
  });

  it('does not call refresh when server returns 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ code: 'INTERNAL_ERROR' }, { status: 500 }),
    );

    await expect(projectsApi.list()).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
  });
});

describe('apiClient — typed errors (not raw Response)', () => {
  it('rejects with object having code field, not a Response instance', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ code: 'VALIDATION_ERROR', fields: { x: 'y' } }, { status: 400 }),
    );

    try {
      await projectsApi.create({ name: 'ok' });
      expect.fail('expected throw');
    } catch (e) {
      expect(e).not.toBeInstanceOf(Response);
      expect(e).toMatchObject({ code: 'VALIDATION_ERROR' });
    }
  });
});

describe('apiClient — VITE_API_URL base URL (PAT-013)', () => {
  it('uses trimmed VITE_API_URL without trailing slashes as API origin', async () => {
    vi.stubEnv('VITE_API_URL', 'https://example.com/v1///');
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    const m = await import('../../../src/utils/apiClient');
    m.configureApiClient({
      getAccessToken: () => 't',
      onAuthFailure,
      onAccessTokenRefreshed,
    });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ projects: [] }));

    await m.projectsApi.list();

    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('https://example.com/v1/api/projects');
  });

  it('defaults to http://127.0.0.1:3001 when VITE_API_URL is blank', async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    const m = await import('../../../src/utils/apiClient');
    m.configureApiClient({
      getAccessToken: () => 't',
      onAuthFailure,
      onAccessTokenRefreshed,
    });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ projects: [] }));

    await m.projectsApi.list();

    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://127.0.0.1:3001/api/projects');
  });
});

describe('apiClient — fetch transport (PAT-007)', () => {
  it('performs HTTP through the global fetch function', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          user: {
            id: 'u1',
            email: 'e@e.com',
            displayName: 'E',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          accessToken: 'x',
        },
        { status: 201 },
      ),
    );

    await authApi.register({ email: 'e@e.com', password: '12345678', displayName: 'E' });

    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
