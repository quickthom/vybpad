/**
 * @vitest-environment jsdom
 */

/*
 * QA COVERAGE PLAN — TASK-3.2
 *
 * Criterion: Project list API wiring (GET /api/projects on load; Bearer token per INTERFACES.md)
 *   happy: authenticated visit to /projects triggers GET with Authorization header
 *   error: n/a for list load (errors surfaced in UI — optional separate criterion)
 *   edges: empty list still performs initial fetch
 *
 * Criterion: Create project flow (POST /api/projects, CreateProjectRequest shape)
 *   happy: primary action sends POST with JSON body including trimmed name
 *   error: 400 ValidationError surfaced to user (non-blocking UX test)
 *   edges: —
 *
 * Criterion: Open project flow + song store hydration (GET /api/projects/:id → ProjectResponse.songData → loadSong)
 *   happy: opening a project loads song document; editor shows metadata title from server songData
 *   error: 404 NotFoundError handled without crashing (optional)
 *   edges: —
 *
 * Criterion: Delete project (DELETE /api/projects/:id, 204)
 *   happy: delete control issues DELETE; list no longer shows that project
 *   error: —
 *   edges: —
 *
 * Criterion: Auth gate (RequireAuth pattern — unauthenticated users cannot reach project list)
 *   happy: /projects with no session shows login screen (same as /editor)
 *   error: —
 *   edges: —
 */

import { randomUUID } from 'node:crypto';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectListResponse, ProjectResponse, SongData } from '@vybpad/shared';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '../../src/app/AppRoutes';
import { useAuthStore } from '../../src/store/authStore';
import { buildDefaultSong, useSongStore } from '../../src/store/songStore';
import { configureApiClient } from '../../src/utils/apiClient';

/** Path-only matching: `apiClient` base URL comes from `import.meta.env` at bundle time (often localhost:3001 in Vitest). */
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

describe('TASK-3.2 project list — auth gate', () => {
  describe('happy path', () => {
    it('redirects unauthenticated visitors from /editor to the login screen (Sign in heading)', async () => {
      vi.mocked(fetch).mockImplementation((input) => {
        const url = requestUrl(input);
        if (url.includes('/api/auth/refresh')) {
          return jsonResponse({ code: 'INVALID_REFRESH_TOKEN' }, { status: 401 });
        }
        return jsonResponse({});
      });

      renderRoutes(['/editor']);

      expect(await screen.findByRole('heading', { name: /^sign in$/i })).toBeInTheDocument();
    });

    it('redirects unauthenticated visitors from /projects to the login screen (Sign in heading)', async () => {
      vi.mocked(fetch).mockImplementation((input) => {
        const url = requestUrl(input);
        if (url.includes('/api/auth/refresh')) {
          return jsonResponse({ code: 'INVALID_REFRESH_TOKEN' }, { status: 401 });
        }
        return jsonResponse({});
      });

      renderRoutes(['/projects']);

      expect(await screen.findByLabelText(/^email/i)).toBeInTheDocument();
    });
  });
});

describe('TASK-3.2 project list — list wiring and layout', () => {
  describe('happy path', () => {
    it('shows a Projects heading when an authenticated user navigates to /projects', async () => {
      useAuthStore.setState({
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'qa@vybpad.test',
          displayName: 'QA User',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        accessToken: 'qa-access-token',
        isAuthenticated: true,
        login: async () => {},
        register: async () => {},
        logout: async () => {},
        refreshToken: async () => {},
      });

      const emptyList: ProjectListResponse = { projects: [] };

      vi.mocked(fetch).mockImplementation((input) => {
        const url = requestUrl(input);
        if (apiPath(url) === '/api/projects') {
          return jsonResponse(emptyList);
        }
        return jsonResponse({});
      });

      renderRoutes(['/projects']);

      expect(await screen.findByRole('heading', { name: /^projects$/i })).toBeInTheDocument();
    });

    it('issues GET /api/projects with Authorization Bearer when the project list view loads', async () => {
      useAuthStore.setState({
        user: {
          id: '22222222-2222-4222-8222-222222222222',
          email: 'qa2@vybpad.test',
          displayName: 'QA Two',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        accessToken: 'qa-access-token-2',
        isAuthenticated: true,
        login: async () => {},
        register: async () => {},
        logout: async () => {},
        refreshToken: async () => {},
      });

      const emptyList: ProjectListResponse = { projects: [] };

      vi.mocked(fetch).mockImplementation((input, init) => {
        const url = requestUrl(input);
        if (apiPath(url) === '/api/projects' && (init?.method ?? 'GET') === 'GET') {
          return jsonResponse(emptyList);
        }
        return jsonResponse({});
      });

      renderRoutes(['/projects']);

      await screen.findByRole('heading', { name: /^projects$/i });

      await waitFor(() => {
        const listCalls = vi.mocked(fetch).mock.calls.filter(([u]) => {
          return apiPath(requestUrl(u)) === '/api/projects';
        });
        expect(listCalls.length).toBeGreaterThanOrEqual(1);
        const [, init] = listCalls[listCalls.length - 1]!;
        const auth = (init?.headers as HeadersInit | undefined)
          ? new Headers(init.headers as HeadersInit).get('Authorization')
          : null;
        expect(auth).toBe('Bearer qa-access-token-2');
      });
    });
  });
});

describe('TASK-3.2 project list — create flow', () => {
  describe('happy path', () => {
    it('sends POST /api/projects with CreateProjectRequest JSON including name when the user creates a project', async () => {
      const user = userEvent.setup();

      useAuthStore.setState({
        user: {
          id: '33333333-3333-4333-8333-333333333333',
          email: 'create@vybpad.test',
          displayName: 'Creator',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        accessToken: 'qa-create-token',
        isAuthenticated: true,
        login: async () => {},
        register: async () => {},
        logout: async () => {},
        refreshToken: async () => {},
      });

      const emptyList: ProjectListResponse = { projects: [] };
      const created = makeProjectResponse(
        '44444444-4444-4444-8444-444444444444',
        'New song',
        'New song',
      );

      vi.mocked(fetch).mockImplementation((input, init) => {
        const url = requestUrl(input);
        if (apiPath(url) === '/api/projects' && (init?.method ?? 'GET') === 'GET') {
          return jsonResponse(emptyList);
        }
        if (apiPath(url) === '/api/projects' && init?.method === 'POST') {
          return jsonResponse(created, { status: 201 });
        }
        return jsonResponse({});
      });

      renderRoutes(['/projects']);

      await screen.findByRole('heading', { name: /^projects$/i });

      const nameField = screen.getByLabelText(/new project name/i);
      await user.type(nameField, 'My New Project');

      await user.click(screen.getByRole('button', { name: /^create project$/i }));

      await waitFor(() => {
        const postCalls = vi.mocked(fetch).mock.calls.filter(
          ([u, i]) => apiPath(requestUrl(u)) === '/api/projects' && i?.method === 'POST',
        );
        expect(postCalls.length).toBeGreaterThanOrEqual(1);
        const body = postCalls[postCalls.length - 1]![1]?.body;
        expect(typeof body).toBe('string');
        const parsed = JSON.parse(body as string) as { name: string };
        expect(parsed.name).toBe('My New Project');
      });
    });
  });

  describe('error handling', () => {
    it('shows a validation message when POST /api/projects returns 400 ValidationError', async () => {
      const user = userEvent.setup();

      useAuthStore.setState({
        user: {
          id: '55555555-5555-4555-8555-555555555555',
          email: 'val@vybpad.test',
          displayName: 'Val',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        accessToken: 'qa-val-token',
        isAuthenticated: true,
        login: async () => {},
        register: async () => {},
        logout: async () => {},
        refreshToken: async () => {},
      });

      const emptyList: ProjectListResponse = { projects: [] };

      vi.mocked(fetch).mockImplementation((input, init) => {
        const url = requestUrl(input);
        if (apiPath(url) === '/api/projects' && (init?.method ?? 'GET') === 'GET') {
          return jsonResponse(emptyList);
        }
        if (apiPath(url) === '/api/projects' && init?.method === 'POST') {
          return jsonResponse(
            { code: 'VALIDATION_ERROR', fields: { name: 'Name is required' } },
            { status: 400 },
          );
        }
        return jsonResponse({});
      });

      renderRoutes(['/projects']);

      await screen.findByRole('heading', { name: /^projects$/i });

      const nameField = screen.getByLabelText(/new project name/i);
      await user.type(nameField, 'Reject me');

      await user.click(screen.getByRole('button', { name: /^create project$/i }));

      expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    });
  });
});

describe('TASK-3.2 project list — open and song store hydration', () => {
  describe('happy path', () => {
    it('loads ProjectResponse.songData into the song store and shows the title on the editor after open', async () => {
      const user = userEvent.setup();

      const projectId = '66666666-6666-4666-8666-666666666666';
      const summary = {
        id: projectId,
        name: 'Opened Project',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-04-13T00:00:00.000Z',
      };
      const detail = makeProjectResponse(projectId, 'Opened Project', 'Hydration-QA-Title');

      useAuthStore.setState({
        user: {
          id: '77777777-7777-4777-8777-777777777777',
          email: 'open@vybpad.test',
          displayName: 'Opener',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        accessToken: 'qa-open-token',
        isAuthenticated: true,
        login: async () => {},
        register: async () => {},
        logout: async () => {},
        refreshToken: async () => {},
      });

      vi.mocked(fetch).mockImplementation((input, init) => {
        const url = requestUrl(input);
        const path = apiPath(url);
        if (path === '/api/projects' && (init?.method ?? 'GET') === 'GET') {
          return jsonResponse({ projects: [summary] });
        }
        if (path === `/api/projects/${projectId}` && (init?.method ?? 'GET') === 'GET') {
          return jsonResponse(detail);
        }
        return jsonResponse({});
      });

      renderRoutes(['/projects']);

      await screen.findByRole('heading', { name: /^projects$/i });

      await user.click(screen.getByRole('button', { name: 'Opened Project' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Hydration-QA-Title' })).toBeInTheDocument();

      expect(useSongStore.getState().song.metadata.title).toBe('Hydration-QA-Title');
      expect(useSongStore.getState().song).toEqual(detail.songData);
    });
  });
});

describe('TASK-3.2 project list — delete flow', () => {
  describe('happy path', () => {
    it('sends DELETE /api/projects/:id and removes the project row from the list', async () => {
      const user = userEvent.setup();

      const idA = '88888888-8888-4888-8888-888888888888';
      const idB = '99999999-9999-4999-8999-999999999999';

      useAuthStore.setState({
        user: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          email: 'del@vybpad.test',
          displayName: 'Deleter',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        accessToken: 'qa-del-token',
        isAuthenticated: true,
        login: async () => {},
        register: async () => {},
        logout: async () => {},
        refreshToken: async () => {},
      });

      const listFirst: ProjectListResponse = {
        projects: [
          {
            id: idA,
            name: 'Alpha',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-04-13T00:00:00.000Z',
          },
          {
            id: idB,
            name: 'Beta',
            createdAt: '2026-01-02T00:00:00.000Z',
            updatedAt: '2026-04-13T00:00:00.000Z',
          },
        ],
      };

      const listAfterDelete: ProjectListResponse = {
        projects: [listFirst.projects[1]!],
      };

      let getCount = 0;

      vi.mocked(fetch).mockImplementation((input, init) => {
        const url = requestUrl(input);
        const path = apiPath(url);
        if (path === '/api/projects' && (init?.method ?? 'GET') === 'GET') {
          getCount += 1;
          return jsonResponse(getCount === 1 ? listFirst : listAfterDelete);
        }
        if (path === `/api/projects/${idA}` && init?.method === 'DELETE') {
          return new Response(null, { status: 204 });
        }
        return jsonResponse({});
      });

      renderRoutes(['/projects']);

      await screen.findByRole('heading', { name: /^projects$/i });

      await user.click(screen.getByRole('button', { name: /delete project alpha/i }));

      await user.click(await screen.findByRole('button', { name: /^delete permanently$/i }));

      await waitFor(() => {
        const deleteCalls = vi.mocked(fetch).mock.calls.filter(
          ([u, i]) => apiPath(requestUrl(u)) === `/api/projects/${idA}` && i?.method === 'DELETE',
        );
        expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /^Alpha/ })).not.toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /^Beta/ })).toBeInTheDocument();
    });
  });
});
