/*
 * QA COVERAGE PLAN — TASK-1B.6 (Phase 1B API integration)
 *
 * Criterion: End-to-end API flow register → login → project CRUD with INTERFACES shapes and HTTP status.
 *   happy: single-chain lifecycle; refresh cookie yields access token usable for projects; default song when songData omitted
 *   error: 401 without Bearer on protected routes; 404 for missing / other-user project
 *   edges: Set-Cookie refresh rotation still authorizes after register
 */
import type { ProjectListResponse, ProjectResponse, ProjectSummary, SongData } from '@vybpad/shared';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryPrisma, asPrismaClient } from './helpers/inMemoryPrisma.js';
import { buildProjectTestApp } from './helpers/buildProjectTestApp.js';

const JWT_SECRET = 'test-jwt-secret-exactly-32-characters!!';

function joinCookieHeader(setCookie: string | string[] | undefined): string {
  if (!setCookie) return '';
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  return parts
    .map((p) => p.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

function expectDefaultSongFactoryShape(song: SongData): void {
  expect(song.version).toBe('1.0');
  expect(song.metadata).toEqual({
    title: 'Untitled',
    key: 'C',
    scale: 'major',
    tempo: 120,
    meter: { numerator: 4, denominator: 4 },
  });
  expect(song.measures).toHaveLength(8);
  for (const m of song.measures) {
    expect(typeof m.id).toBe('string');
    expect(m.chords).toEqual([]);
    expect(m.notes).toEqual([[], [], [], []]);
  }
  expect(song.bandConfig.tracks).toHaveLength(7);
  const roles = song.bandConfig.tracks.map((t) => t.role);
  expect(roles).toEqual(['melody1', 'melody2', 'melody3', 'melody4', 'harmony', 'bass', 'drums']);
}

/** INTERFACES.md — full ProjectResponse contract (IDs + timestamps + embedded song). */
function expectProjectResponseContract(p: ProjectResponse): void {
  expect(p).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String),
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    }),
  );
  expect(p.songData).toBeTruthy();
  expect(typeof p.songData.version).toBe('string');
}

function expectProjectSummaryContract(s: ProjectSummary): void {
  expect(s).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String),
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    }),
  );
  expect(s).not.toHaveProperty('songData');
}

describe('TASK-1B.6 API integration — auth + project lifecycle', () => {
  let store: InMemoryPrisma;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-minimum!!';
    process.env.NODE_ENV = 'development';
    store = new InMemoryPrisma();
  });

  describe('happy path', () => {
    it('registers, logs in, creates a project without songData (default factory), lists, gets, updates, deletes with expected status codes and response shapes', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));

      const reg = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'lifecycle@integration.example',
          password: 'password123',
          displayName: 'Lifecycle User',
        },
      });
      expect(reg.statusCode).toBe(201);
      const regBody = reg.json() as {
        user: { id: string; email: string; displayName: string; createdAt: string };
        accessToken: string;
      };
      expect(regBody.user).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: 'lifecycle@integration.example',
          displayName: 'Lifecycle User',
          createdAt: expect.any(String),
        }),
      );
      expect(regBody.accessToken).toEqual(expect.any(String));
      const regCookie = joinCookieHeader(reg.headers['set-cookie']);
      expect(regCookie).toMatch(/refreshToken=/);

      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'lifecycle@integration.example', password: 'password123' },
      });
      expect(login.statusCode).toBe(200);
      const loginBody = login.json() as { user: { email: string }; accessToken: string };
      expect(loginBody.user.email).toBe('lifecycle@integration.example');
      const access = loginBody.accessToken;

      const created = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${access}`,
        },
        payload: { name: 'Integration Project' },
      });
      expect(created.statusCode).toBe(201);
      const project = created.json() as ProjectResponse;
      expectProjectResponseContract(project);
      expect(project.name).toBe('Integration Project');
      expectDefaultSongFactoryShape(project.songData);

      const list = await app.inject({
        method: 'GET',
        url: '/api/projects',
        headers: { authorization: `Bearer ${access}` },
      });
      expect(list.statusCode).toBe(200);
      const listBody = list.json() as ProjectListResponse;
      expect(listBody.projects.length).toBe(1);
      expectProjectSummaryContract(listBody.projects[0]!);
      expect(listBody.projects[0]).toEqual(
        expect.objectContaining({
          id: project.id,
          name: 'Integration Project',
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        }),
      );

      const getOne = await app.inject({
        method: 'GET',
        url: `/api/projects/${project.id}`,
        headers: { authorization: `Bearer ${access}` },
      });
      expect(getOne.statusCode).toBe(200);
      const fetched = getOne.json() as ProjectResponse;
      expectProjectResponseContract(fetched);
      expect(fetched.id).toBe(project.id);
      expect(fetched.name).toBe(project.name);
      expect(fetched.createdAt).toBe(project.createdAt);
      expect(fetched.updatedAt).toBe(project.updatedAt);
      expect(fetched.songData).toEqual(project.songData);

      const updated = await app.inject({
        method: 'PUT',
        url: `/api/projects/${project.id}`,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${access}`,
        },
        payload: { name: 'Renamed Integration' },
      });
      expect(updated.statusCode).toBe(200);
      const afterRename = updated.json() as ProjectResponse;
      expectProjectResponseContract(afterRename);
      expect(afterRename.name).toBe('Renamed Integration');
      expect(afterRename.songData).toEqual(project.songData);
      expect(afterRename.id).toBe(project.id);

      const del = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${project.id}`,
        headers: { authorization: `Bearer ${access}` },
      });
      expect(del.statusCode).toBe(204);
      expect(del.body).toBe('');

      const gone = await app.inject({
        method: 'GET',
        url: `/api/projects/${project.id}`,
        headers: { authorization: `Bearer ${access}` },
      });
      expect(gone.statusCode).toBe(404);
      expect(gone.json()).toEqual({ code: 'NOT_FOUND', resource: 'project' });

      await app.close();
    });

    it('issues a new access token via POST /api/auth/refresh using the register Set-Cookie and that token authorizes GET /api/projects', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));

      const reg = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'refreshflow@integration.example',
          password: 'password123',
          displayName: 'Refresh',
        },
      });
      expect(reg.statusCode).toBe(201);
      const cookie = joinCookieHeader(reg.headers['set-cookie']);

      const ref = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie },
      });
      expect(ref.statusCode).toBe(200);
      const regBody = reg.json() as { accessToken: string };
      const refBody = ref.json() as { accessToken: string };
      expect(refBody.accessToken).toEqual(expect.any(String));

      const prev = jwt.decode(regBody.accessToken) as jwt.JwtPayload & { userId?: string };
      const next = jwt.decode(refBody.accessToken) as jwt.JwtPayload & { userId?: string };
      expect(next?.userId).toBe(prev?.userId);

      const rotated = joinCookieHeader(ref.headers['set-cookie']);
      expect(rotated).toMatch(/refreshToken=/);
      const v0 = cookie.split('refreshToken=')[1]?.split(';')[0] ?? '';
      const v1 = rotated.split('refreshToken=')[1]?.split(';')[0] ?? '';
      expect(v1.length).toBeGreaterThan(0);
      expect(v0).not.toBe(v1);

      const list = await app.inject({
        method: 'GET',
        url: '/api/projects',
        headers: { authorization: `Bearer ${refBody.accessToken}` },
      });
      expect(list.statusCode).toBe(200);
      expect((list.json() as ProjectListResponse).projects).toEqual([]);

      await app.close();
    });
  });

  describe('error handling', () => {
    it('returns 401 UNAUTHORIZED for POST /api/projects when no Bearer token is sent', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: { 'content-type': 'application/json' },
        payload: { name: 'Should Fail' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'UNAUTHORIZED' });
      await app.close();
    });

    it('returns 401 UNAUTHORIZED for GET /api/projects/:id when no Bearer token is sent', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/00000000-0000-4000-8000-000000000001',
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'UNAUTHORIZED' });
      await app.close();
    });

    it('returns 404 NOT_FOUND project for a random uuid when the user is authenticated', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const reg = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'missing@integration.example',
          password: 'password123',
          displayName: 'M',
        },
      });
      const token = (reg.json() as { accessToken: string }).accessToken;
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/00000000-0000-4000-8000-000000000099',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NOT_FOUND', resource: 'project' });
      await app.close();
    });
  });
});
