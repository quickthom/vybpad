/**
 * @vitest-environment jsdom
 */

/*
 * QA COVERAGE PLAN — TASK-3.3
 *
 * Criterion 1: Opening editor for a project loads GET /api/projects/:id and hydrates song store; isDirty false after load.
 *   happy: navigating to /editor/:projectId issues GET with Bearer; song store matches ProjectResponse.songData; isDirty false
 *   error: see criterion 3 for load failures
 *   edges: —
 *
 * Criterion 2: Save triggers PUT /api/projects/:id with current songData; success clears isDirty; failure shows error path without silent drop.
 *   happy: after load + edit, Save sends PUT with UpdateProjectRequest.songData matching store; 200 → isDirty false
 *   error: PUT non-OK shows role=alert with user-visible message; isDirty stays true
 *   edges: —
 *
 * Criterion 3: Auth/error paths (401/403/404) per existing api error handling.
 *   404 on GET: NOT_FOUND surfaced (toast / alert)
 *   401 on GET: UNAUTHORIZED surfaced when refresh cannot recover
 *   403 on GET: user-visible error (not silent)
 */

import { randomUUID } from 'node:crypto';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectResponse, SongData } from '@vybpad/shared';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '../../src/app/AppRoutes';
import { useAuthStore } from '../../src/store/authStore';
import { buildDefaultSong, useSongStore } from '../../src/store/songStore';
import { configureApiClient } from '../../src/utils/apiClient';
import { ERROR_MESSAGES } from '../../src/utils/errorMessages';

function apiPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as HeadersInit) },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

function makeSongData(title: string): SongData {
  return {
    version: '1.0',
    metadata: {
      title,
      key: 'C',
      scale: 'major',
      tempo: 120,
      meter: { numerator: 4, denominator: 4 },
    },
    measures: [
      {
        id: randomUUID(),
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
}

function makeProjectResponse(id: string, name: string, songTitle: string): ProjectResponse {
  const now = '2026-04-13T12:00:00.000Z';
  return {
    id,
    name,
    songData: makeSongData(songTitle),
    createdAt: now,
    updatedAt: now,
  };
}

function renderRoutes(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

function setAuthenticatedUser() {
  useAuthStore.setState({
    user: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'save-load@vybpad.test',
      displayName: 'SaveLoad QA',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    accessToken: 'qa-task-3-3-token',
    isAuthenticated: true,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
    refreshToken: async () => {},
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());

  configureApiClient({
    getAccessToken: () => useAuthStore.getState().accessToken,
    onAuthFailure: vi.fn(() => {
      useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
    }),
    onAccessTokenRefreshed: (accessToken) => {
      useAuthStore.setState({ accessToken, isAuthenticated: true });
    },
  });

  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
    refreshToken: async () => {
      throw new Error('refreshToken not wired in test');
    },
  });

  useSongStore.getState().loadSong(buildDefaultSong());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('TASK-3.3 save/load — open project in editor (GET /api/projects/:id)', () => {
  describe('happy path', () => {
    it('issues GET /api/projects/:id with Bearer when opening /editor/:projectId, hydrates SongStore from ProjectResponse.songData, and sets isDirty to false', async () => {
      setAuthenticatedUser();

      const projectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const detail = makeProjectResponse(projectId, 'Server Name', 'Load-Contract-Title');

      vi.mocked(fetch).mockImplementation((input, init) => {
        const url = requestUrl(input);
        const path = apiPath(url);
        if (path === `/api/projects/${projectId}` && (init?.method ?? 'GET') === 'GET') {
          return jsonResponse(detail);
        }
        if (path === '/api/auth/refresh' && (init?.method ?? 'POST') === 'POST') {
          return jsonResponse({ code: 'INVALID_REFRESH_TOKEN' }, { status: 401 });
        }
        return jsonResponse({});
      });

      renderRoutes([`/editor/${projectId}`]);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Load-Contract-Title' }),
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(useSongStore.getState().song).toEqual(detail.songData);
        expect(useSongStore.getState().isDirty).toBe(false);
      });

      const getCalls = vi.mocked(fetch).mock.calls.filter(([u, i]) => {
        return apiPath(requestUrl(u)) === `/api/projects/${projectId}` && (i?.method ?? 'GET') === 'GET';
      });
      expect(getCalls.length).toBeGreaterThanOrEqual(1);
      const [, init] = getCalls[getCalls.length - 1]!;
      const auth = new Headers(init?.headers as HeadersInit).get('Authorization');
      expect(auth).toBe('Bearer qa-task-3-3-token');
    });
  });
});

describe('TASK-3.3 save/load — save (PUT /api/projects/:id)', () => {
  describe('happy path', () => {
    it('sends PUT /api/projects/:id with UpdateProjectRequest containing current songData, clears isDirty on 200 ProjectResponse', async () => {
      const user = userEvent.setup();
      setAuthenticatedUser();

      const projectId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const loaded = makeProjectResponse(projectId, 'P', 'Before Edit');

      vi.mocked(fetch).mockImplementation((input, init) => {
        const url = requestUrl(input);
        const path = apiPath(url);
        if (path === `/api/projects/${projectId}` && (init?.method ?? 'GET') === 'GET') {
          return jsonResponse(loaded);
        }
        if (path === `/api/projects/${projectId}` && init?.method === 'PUT') {
          const updated: ProjectResponse = {
            ...loaded,
            songData: (JSON.parse(init.body as string) as { songData: SongData }).songData,
            updatedAt: '2026-04-13T13:00:00.000Z',
          };
          return jsonResponse(updated);
        }
        if (path === '/api/auth/refresh' && (init?.method ?? 'POST') === 'POST') {
          return jsonResponse({ code: 'INVALID_REFRESH_TOKEN' }, { status: 401 });
        }
        return jsonResponse({});
      });

      renderRoutes([`/editor/${projectId}`]);

      await screen.findByRole('heading', { level: 1, name: 'Before Edit' });

      act(() => {
        useSongStore.getState().updateMetadata({ title: 'After Edit' });
      });
      expect(useSongStore.getState().isDirty).toBe(true);

      const saveButton = await screen.findByRole('button', { name: /^save/i });
      await user.click(saveButton);

      await waitFor(() => {
        const putCalls = vi.mocked(fetch).mock.calls.filter(
          ([u, i]) => apiPath(requestUrl(u)) === `/api/projects/${projectId}` && i?.method === 'PUT',
        );
        expect(putCalls.length).toBeGreaterThanOrEqual(1);
        const body = putCalls[putCalls.length - 1]![1]?.body;
        expect(typeof body).toBe('string');
        const parsed = JSON.parse(body as string) as { songData?: SongData };
        expect(parsed.songData).toEqual(useSongStore.getState().song);
      });

      await waitFor(() => {
        expect(useSongStore.getState().isDirty).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    it('shows an assertive alert with a user-visible message when PUT fails and leaves isDirty true (no silent drop)', async () => {
      const user = userEvent.setup();
      setAuthenticatedUser();

      const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const loaded = makeProjectResponse(projectId, 'P', 'No Save');

      vi.mocked(fetch).mockImplementation((input, init) => {
        const url = requestUrl(input);
        const path = apiPath(url);
        if (path === `/api/projects/${projectId}` && (init?.method ?? 'GET') === 'GET') {
          return jsonResponse(loaded);
        }
        if (path === `/api/projects/${projectId}` && init?.method === 'PUT') {
          return jsonResponse({ code: 'INTERNAL_ERROR', message: 'DB down' }, { status: 500 });
        }
        if (path === '/api/auth/refresh' && (init?.method ?? 'POST') === 'POST') {
          return jsonResponse({ code: 'INVALID_REFRESH_TOKEN' }, { status: 401 });
        }
        return jsonResponse({});
      });

      renderRoutes([`/editor/${projectId}`]);

      await screen.findByRole('heading', { level: 1, name: 'No Save' });

      act(() => {
        useSongStore.getState().updateMetadata({ title: 'Try Save Fail' });
      });

      const saveButton = await screen.findByRole('button', { name: /^save/i });
      await user.click(saveButton);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.INTERNAL_ERROR);

      await waitFor(() => {
        expect(useSongStore.getState().isDirty).toBe(true);
      });
    });
  });
});

describe('TASK-3.3 save/load — API error handling (401 / 403 / 404)', () => {
  describe('error handling', () => {
    it('surfaces NOT_FOUND when GET /api/projects/:id returns 404 with NotFoundError body', async () => {
      setAuthenticatedUser();

      const projectId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

      vi.mocked(fetch).mockImplementation((input, init) => {
        const url = requestUrl(input);
        const path = apiPath(url);
        if (path === `/api/projects/${projectId}` && (init?.method ?? 'GET') === 'GET') {
          return jsonResponse({ code: 'NOT_FOUND', resource: 'project' }, { status: 404 });
        }
        if (path === '/api/auth/refresh' && (init?.method ?? 'POST') === 'POST') {
          return jsonResponse({ code: 'INVALID_REFRESH_TOKEN' }, { status: 401 });
        }
        return jsonResponse({});
      });

      renderRoutes([`/editor/${projectId}`]);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.NOT_FOUND);
    });

    it('surfaces UNAUTHORIZED when GET /api/projects/:id returns 401 and refresh cannot recover', async () => {
      setAuthenticatedUser();

      const projectId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

      vi.mocked(fetch).mockImplementation((input, init) => {
        const url = requestUrl(input);
        const path = apiPath(url);
        if (path === `/api/projects/${projectId}` && (init?.method ?? 'GET') === 'GET') {
          return jsonResponse({ code: 'UNAUTHORIZED' }, { status: 401 });
        }
        if (path === '/api/auth/refresh' && (init?.method ?? 'POST') === 'POST') {
          return jsonResponse({ code: 'INVALID_REFRESH_TOKEN' }, { status: 401 });
        }
        return jsonResponse({});
      });

      renderRoutes([`/editor/${projectId}`]);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.UNAUTHORIZED);
    });

    it('surfaces a user-visible error when GET /api/projects/:id returns 403 (not silent)', async () => {
      setAuthenticatedUser();

      const projectId = '12121212-1212-4121-8121-121212121212';

      vi.mocked(fetch).mockImplementation((input, init) => {
        const url = requestUrl(input);
        const path = apiPath(url);
        if (path === `/api/projects/${projectId}` && (init?.method ?? 'GET') === 'GET') {
          return jsonResponse({ code: 'INTERNAL_ERROR', message: 'Forbidden' }, { status: 403 });
        }
        if (path === '/api/auth/refresh' && (init?.method ?? 'POST') === 'POST') {
          return jsonResponse({ code: 'INVALID_REFRESH_TOKEN' }, { status: 401 });
        }
        return jsonResponse({});
      });

      renderRoutes([`/editor/${projectId}`]);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.INTERNAL_ERROR);
    });
  });
});
