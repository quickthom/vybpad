/*
 * QA COVERAGE PLAN — TASK-3.1
 *
 * Criterion 1: Auth store matches AuthStore contract behavior (INTERFACES.md)
 *   happy: login/register success updates user, accessToken, isAuthenticated; logout clears; refresh updates token
 *   error: login/register reject with AuthError / ConflictError / ValidationError from API; state unchanged on failed login
 *   edges: initial state null/false; register duplicate email
 *
 * Criterion 2: Register/login flows call correct endpoints and handle errors
 *   happy: (covered via store actions + fetch mocks asserting URL/method/body)
 *   error: 401 INVALID_CREDENTIALS, 409 EMAIL_ALREADY_EXISTS, 400 VALIDATION_ERROR
 *
 * Criterion 3: Routing — covered in client/tests/component/authRouting.test.tsx
 *
 * Criterion 4: apiClient + token refresh — covered in initAuthApiClient.test.ts and existing apiClient.test.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../../src/store/authStore';

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as HeadersInit) },
  });
}

const sampleUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'ada@example.com',
  displayName: 'Ada',
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.stubEnv('VITE_API_URL', 'http://api.test');
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('AuthStore — TASK-3.1 contract (INTERFACES.md)', () => {
  describe('initial state', () => {
    it('exposes user null, accessToken null, and isAuthenticated false before any action', () => {
      const s = useAuthStore.getState();
      expect(s.user).toBeNull();
      expect(s.accessToken).toBeNull();
      expect(s.isAuthenticated).toBe(false);
    });
  });

  describe('happy path', () => {
    it('sets user, accessToken, and isAuthenticated true after login receives 200 AuthResponse', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse(
          { user: sampleUser, accessToken: 'jwt-access' },
          { status: 200 },
        ),
      );

      await useAuthStore.getState().login('ada@example.com', 'correcthorse');

      const s = useAuthStore.getState();
      expect(s.user).toEqual(sampleUser);
      expect(s.accessToken).toBe('jwt-access');
      expect(s.isAuthenticated).toBe(true);
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/auth/login');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).method).toBe('POST');
    });

    it('sets user, accessToken, and isAuthenticated true after register receives 201 AuthResponse', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse(
          { user: sampleUser, accessToken: 'jwt-new' },
          { status: 201 },
        ),
      );

      await useAuthStore.getState().register('ada@example.com', 'password12', 'Ada');

      const s = useAuthStore.getState();
      expect(s.user).toEqual(sampleUser);
      expect(s.accessToken).toBe('jwt-new');
      expect(s.isAuthenticated).toBe(true);
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/auth/register');
    });

    it('clears user, accessToken, and sets isAuthenticated false after logout succeeds with 204', async () => {
      useAuthStore.setState({
        user: sampleUser,
        accessToken: 'jwt-access',
        isAuthenticated: true,
      });
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

      await useAuthStore.getState().logout();

      const s = useAuthStore.getState();
      expect(s.user).toBeNull();
      expect(s.accessToken).toBeNull();
      expect(s.isAuthenticated).toBe(false);
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/auth/logout');
    });

    it('updates accessToken after refreshToken receives RefreshResponse', async () => {
      useAuthStore.setState({
        user: sampleUser,
        accessToken: 'old-access',
        isAuthenticated: true,
      });
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ accessToken: 'rotated-access' }));

      await useAuthStore.getState().refreshToken();

      expect(useAuthStore.getState().accessToken).toBe('rotated-access');
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/auth/refresh');
    });
  });

  describe('error handling', () => {
    it('rejects with INVALID_CREDENTIALS and leaves session unchanged when login returns 401', async () => {
      useAuthStore.setState({
        user: null,
        accessToken: null,
        isAuthenticated: false,
      });
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ code: 'INVALID_CREDENTIALS' }, { status: 401 }),
      );

      await expect(useAuthStore.getState().login('ada@example.com', 'wrong')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });

      const s = useAuthStore.getState();
      expect(s.user).toBeNull();
      expect(s.accessToken).toBeNull();
      expect(s.isAuthenticated).toBe(false);
    });

    it('rejects with EMAIL_ALREADY_EXISTS when register returns 409', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ code: 'EMAIL_ALREADY_EXISTS' }, { status: 409 }),
      );

      await expect(
        useAuthStore.getState().register('taken@example.com', 'password12', 'Ada'),
      ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('rejects with VALIDATION_ERROR when register returns 400', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse(
          { code: 'VALIDATION_ERROR', fields: { password: 'Too short' } },
          { status: 400 },
        ),
      );

      await expect(
        useAuthStore.getState().register('x@y.com', 'short', 'Ada'),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: { password: 'Too short' },
      });
    });
  });

  describe('edge cases', () => {
    it('sends register body matching RegisterRequest fields', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ user: sampleUser, accessToken: 't' }, { status: 201 }),
      );

      await useAuthStore.getState().register('z@z.com', 'abcdefgh', 'Zed');

      const body = (vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body;
      expect(body).toBe(JSON.stringify({ email: 'z@z.com', password: 'abcdefgh', displayName: 'Zed' }));
    });
  });
});
