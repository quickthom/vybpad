/**
 * @vitest-environment jsdom
 */

/*
 * QA COVERAGE PLAN — TASK-3.4
 *
 * Criterion: Debounced autosave calls projectsApi.update after song mutations (fake timers).
 *   happy: after an edit, flushing timers triggers projectsApi.update with current songData; success clears isDirty
 *   error: rejected update leaves isDirty true
 *   edges: coalescing — rapid mutations yield a single update carrying the latest song snapshot; editChord counts as a song mutation
 *
 * Contract: behavior is verified via public `projectsApi` (INTERFACES.md project API) and SongStore.isDirty.
 */

import { randomUUID } from 'node:crypto';

import { act, render, screen, waitFor } from '@testing-library/react';
import type { ChordEvent, ProjectResponse, SongData } from '@vybpad/shared';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '../../src/app/AppRoutes';
import { useAuthStore } from '../../src/store/authStore';
import { buildDefaultSong, useSongStore } from '../../src/store/songStore';
import { configureApiClient } from '../../src/utils/apiClient';

const { mockGet, mockUpdate } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('../../src/utils/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/apiClient')>();
  return {
    ...actual,
    projectsApi: {
      ...actual.projectsApi,
      get: mockGet,
      update: mockUpdate,
    },
  };
});

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

function minimalChordToAdd(): Omit<ChordEvent, 'id'> {
  return {
    scaleDegree: 1,
    quality: 'major',
    seventh: 'none',
    suspension: 'none',
    addition: 'none',
    inversion: 0,
    borrowed: null,
    secondary: null,
    beat: 0,
    duration: 48,
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
      email: 'autosave@vybpad.test',
      displayName: 'Autosave QA',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    accessToken: 'qa-task-3-4-token',
    isAuthenticated: true,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
    refreshToken: async () => {},
  });
}

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as HeadersInit) },
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

  vi.mocked(fetch).mockImplementation((input, init) => {
    const path = new URL(requestUrl(input), 'http://local.test').pathname;
    if (path === '/api/auth/refresh' && (init?.method ?? 'POST') === 'POST') {
      return jsonResponse({ code: 'INVALID_REFRESH_TOKEN' }, { status: 401 });
    }
    return jsonResponse({});
  });

  mockGet.mockReset();
  mockUpdate.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Use after editor is on-screen so RTL/async load is not blocked by mocked timers. */
function useAutosaveFakeTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
}

describe('TASK-3.4 auto-save — debounced projectsApi.update after song mutations', () => {
  describe('happy path', () => {
    it('does not call projectsApi.update synchronously on mutation; after timer flush calls update with current songData and clears isDirty on success', async () => {
      setAuthenticatedUser();

      const projectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const loaded = makeProjectResponse(projectId, 'Project P', 'Before');

      mockGet.mockResolvedValue(loaded);
      mockUpdate.mockImplementation(async (_id, req) => ({
        ...loaded,
        songData: req.songData ?? loaded.songData,
        updatedAt: '2026-04-13T15:00:00.000Z',
      }));

      renderRoutes([`/editor/${projectId}`]);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Before' }),
      ).toBeInTheDocument();

      expect(mockUpdate).not.toHaveBeenCalled();

      useAutosaveFakeTimers();

      act(() => {
        useSongStore.getState().updateMetadata({ title: 'After Autosave' });
      });
      expect(useSongStore.getState().isDirty).toBe(true);
      expect(mockUpdate).not.toHaveBeenCalled();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          songData: useSongStore.getState().song,
        }),
      );

      vi.useRealTimers();
      await waitFor(() => {
        expect(useSongStore.getState().isDirty).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('calls projectsApi.update after editChord when the debounce window elapses', async () => {
      setAuthenticatedUser();

      const projectId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const loaded = makeProjectResponse(projectId, 'Chord', 'Chordy');

      mockGet.mockResolvedValue(loaded);
      mockUpdate.mockImplementation(async (_id, req) => ({
        ...loaded,
        songData: req.songData ?? loaded.songData,
        updatedAt: '2026-04-13T17:00:00.000Z',
      }));

      renderRoutes([`/editor/${projectId}`]);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Chordy' }),
      ).toBeInTheDocument();

      mockUpdate.mockClear();

      useAutosaveFakeTimers();

      act(() => {
        useSongStore.getState().editChord(0, { type: 'add', chord: minimalChordToAdd() });
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.useRealTimers();

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          songData: expect.objectContaining({
            measures: expect.arrayContaining([
              expect.objectContaining({
                chords: expect.arrayContaining([expect.objectContaining({ scaleDegree: 1 })]),
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('coalescing', () => {
    it('issues only one projectsApi.update after multiple rapid song mutations when timers flush once', async () => {
      setAuthenticatedUser();

      const projectId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const loaded = makeProjectResponse(projectId, 'Coalesce', 'Start');

      mockGet.mockResolvedValue(loaded);
      mockUpdate.mockImplementation(async (_id, req) => ({
        ...loaded,
        songData: req.songData ?? loaded.songData,
        updatedAt: '2026-04-13T16:00:00.000Z',
      }));

      renderRoutes([`/editor/${projectId}`]);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Start' }),
      ).toBeInTheDocument();

      useAutosaveFakeTimers();

      act(() => {
        useSongStore.getState().updateMetadata({ title: 'First' });
        useSongStore.getState().updateMetadata({ title: 'Second' });
        useSongStore.getState().updateMetadata({ title: 'Third' });
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          songData: expect.objectContaining({
            metadata: expect.objectContaining({ title: 'Third' }),
          }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('leaves isDirty true when projectsApi.update rejects after a debounced autosave', async () => {
      setAuthenticatedUser();

      const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const loaded = makeProjectResponse(projectId, 'Err', 'Stable');

      mockGet.mockResolvedValue(loaded);
      mockUpdate.mockRejectedValue(new Error('network failed'));

      renderRoutes([`/editor/${projectId}`]);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Stable' }),
      ).toBeInTheDocument();

      useAutosaveFakeTimers();

      act(() => {
        useSongStore.getState().updateMetadata({ title: 'Unsaved After Fail' });
      });

      // Only the initial debounce — do not flush PAT-001 retry timers or rejections recurse forever.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(mockUpdate).toHaveBeenCalled();

      vi.useRealTimers();
      await waitFor(() => {
        expect(useSongStore.getState().isDirty).toBe(true);
      });
      expect(useSongStore.getState().song.metadata.title).toBe('Unsaved After Fail');
    });
  });

  describe('in-flight save races', () => {
    it('does not apply loadSong from a stale PUT when the user edited again before the response', async () => {
      setAuthenticatedUser();

      const projectId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      const loaded = makeProjectResponse(projectId, 'Race', 'Base');

      mockGet.mockResolvedValue(loaded);

      let unblockFirst!: () => void;
      const firstGate = new Promise<void>((resolve) => {
        unblockFirst = resolve;
      });

      mockUpdate
        .mockImplementationOnce(async (_id, req) => {
          await firstGate;
          return {
            ...loaded,
            songData: req.songData!,
            updatedAt: '2026-04-13T18:00:00.000Z',
          };
        })
        .mockImplementation(async (_id, req) => ({
          ...loaded,
          songData: req.songData!,
          updatedAt: '2026-04-13T18:05:00.000Z',
        }));

      renderRoutes([`/editor/${projectId}`]);

      expect(await screen.findByRole('heading', { level: 1, name: 'Base' })).toBeInTheDocument();

      useAutosaveFakeTimers();

      act(() => {
        useSongStore.getState().updateMetadata({ title: 'Inflight' });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);

      act(() => {
        useSongStore.getState().updateMetadata({ title: 'AfterInflight' });
      });

      expect(useSongStore.getState().song.metadata.title).toBe('AfterInflight');
      expect(useSongStore.getState().isDirty).toBe(true);

      await act(async () => {
        unblockFirst();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(useSongStore.getState().song.metadata.title).toBe('AfterInflight');

      vi.useRealTimers();
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledTimes(2);
        expect(useSongStore.getState().isDirty).toBe(false);
      });

      expect(mockUpdate).toHaveBeenNthCalledWith(
        2,
        projectId,
        expect.objectContaining({
          songData: expect.objectContaining({
            metadata: expect.objectContaining({ title: 'AfterInflight' }),
          }),
        }),
      );
    });
  });
});
