/*
 * QA COVERAGE PLAN — TASK-3.1 (criterion 4)
 *
 * Production wiring lives in `main.tsx` (configureApiClient + useAuthStore). These tests lock the
 * same behavior: access token read from the store and refreshed tokens persisted before retry.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as HeadersInit) },
  });
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn());
  vi.stubEnv('VITE_API_URL', 'http://api.test');

  const { useAuthStore } = await import('@/store/authStore');
  const { configureApiClient } = await import('@/utils/apiClient');

  configureApiClient({
    getAccessToken: () => useAuthStore.getState().accessToken,
    onAuthFailure: () => {
      useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
    },
    onAccessTokenRefreshed: (accessToken) => {
      useAuthStore.setState({ accessToken, isAuthenticated: true });
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('apiClient + auth store — TASK-3.1 (main.tsx wiring contract)', () => {
  describe('happy path', () => {
    it('persists refreshed accessToken in Zustand before retrying a 401-protected request', async () => {
      const { useAuthStore } = await import('@/store/authStore');
      const { projectsApi } = await import('@/utils/apiClient');

      useAuthStore.setState({
        user: {
          id: 'u1',
          email: 'a@b.com',
          displayName: 'A',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        accessToken: 'expired-access',
        isAuthenticated: true,
      });

      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'TOKEN_EXPIRED' }), { status: 401 }),
        )
        .mockResolvedValueOnce(jsonResponse({ accessToken: 'fresh-access' }))
        .mockResolvedValueOnce(jsonResponse({ projects: [] }));

      await projectsApi.list();

      expect(useAuthStore.getState().accessToken).toBe('fresh-access');
    });

    it('sends Bearer accessToken from the auth store on the first authorized request', async () => {
      const { useAuthStore } = await import('@/store/authStore');
      const { projectsApi } = await import('@/utils/apiClient');

      useAuthStore.setState({
        accessToken: 'first-token',
        isAuthenticated: true,
        user: {
          id: 'u1',
          email: 'a@b.com',
          displayName: 'A',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      });
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ projects: [] }));

      await projectsApi.list();

      const init = vi.mocked(fetch).mock.calls[0]![1] as RequestInit;
      const headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers as HeadersInit);
      expect(headers.get('Authorization')).toBe('Bearer first-token');
    });
  });
});
