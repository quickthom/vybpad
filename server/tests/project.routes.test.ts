/*
 * QA COVERAGE PLAN — TASK-1B.3
 *
 * Criterion 1: GET /api/projects — 200, current user only, ProjectSummary (no song)
 *   happy: list shape, isolation between users
 *   error: N/A
 *   edges: summary keys only; ordering by updated_at desc (contract with service)
 *
 * Criterion 2: POST /api/projects — 201 ProjectResponse; default song when songData omitted; 400 bad name
 *   happy: 201 + body; omitted songData matches INTERFACES default factory shape
 *   error: ValidationError bad name; invalid songData
 *   edges: trimmed name
 *
 * Criterion 3: GET /api/projects/:id — 200 owner; 404 other user or unknown
 *   happy: 200 + ProjectResponse
 *   error: 404 NOT_FOUND project
 *   edges: uuid param validation
 *
 * Criterion 4: PUT partial — 200; 404 not found
 *   happy: name-only partial update
 *   error: 404; optional ValidationError for bad name
 *
 * Criterion 5: DELETE — 204; 404 not found
 *
 * Criterion 6: Unauthenticated — 401 per existing auth pattern (UNAUTHORIZED)
 */
import type { ProjectListResponse, ProjectResponse, SongData } from '@vybpad/shared';
import { describe, it, expect, beforeEach } from 'vitest';

import { InMemoryPrisma, asPrismaClient } from './helpers/inMemoryPrisma.js';
import { buildProjectTestApp } from './helpers/buildProjectTestApp.js';

const JWT_SECRET = 'test-jwt-secret-exactly-32-characters!!';

/** Valid minimal SongData for POST body (single measure); satisfies server structural validation. */
function minimalCustomSong(measureId: string): SongData {
  return {
    version: '1.0',
    metadata: {
      title: 'Custom',
      key: 'D',
      scale: 'minor',
      tempo: 90,
      meter: { numerator: 3, denominator: 4 },
    },
    measures: [
      {
        id: measureId,
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
  expect(song.bandConfig.tracks[0]).toMatchObject({
    role: 'melody1',
    instrument: 'piano',
    volume: 0.8,
    mute: false,
    octave: 0,
  });
  expect(song.bandConfig.tracks[5]).toMatchObject({
    role: 'bass',
    instrument: 'piano',
    volume: 0.5,
    mute: false,
    octave: -1,
  });
  expect(song.bandConfig.tracks[6]).toMatchObject({
    role: 'drums',
    instrument: 'piano',
    volume: 0.0,
    mute: true,
    octave: 0,
  });
}

async function registerAndGetAccessToken(
  app: Awaited<ReturnType<typeof buildProjectTestApp>>,
  email: string,
  displayName: string,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: { email, password: 'password123', displayName },
  });
  expect(res.statusCode).toBe(201);
  return (res.json() as { accessToken: string }).accessToken;
}

describe('TASK-1B.3 project routes — GET /api/projects', () => {
  let store: InMemoryPrisma;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-minimum!!';
    process.env.NODE_ENV = 'development';
    store = new InMemoryPrisma();
  });

  describe('happy path', () => {
    it('returns 200 with ProjectListResponse whose projects are ProjectSummary rows without songData', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const token = await registerAndGetAccessToken(app, 'list@example.com', 'Lister');
      await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: { name: 'Alpha' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/projects',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as ProjectListResponse;
      expect(Array.isArray(body.projects)).toBe(true);
      expect(body.projects.length).toBeGreaterThanOrEqual(1);
      const row = body.projects[0]!;
      expect(Object.keys(row).sort()).toEqual(['createdAt', 'id', 'name', 'updatedAt'].sort());
      expect(row.name).toBe('Alpha');
      expect(row.id).toEqual(expect.any(String));
      expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(row.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      await app.close();
    });

    it('returns only projects owned by the authenticated user', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const tokenA = await registerAndGetAccessToken(app, 'a@example.com', 'A');
      const tokenB = await registerAndGetAccessToken(app, 'b@example.com', 'B');

      const createdB = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${tokenB}`,
        },
        payload: { name: 'Secret B' },
      });
      expect(createdB.statusCode).toBe(201);
      const idB = (createdB.json() as ProjectResponse).id;

      await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${tokenA}`,
        },
        payload: { name: 'Only A' },
      });

      const listA = await app.inject({
        method: 'GET',
        url: '/api/projects',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listA.statusCode).toBe(200);
      const idsA = (listA.json() as ProjectListResponse).projects.map((p) => p.id);
      expect(idsA).not.toContain(idB);

      await app.close();
    });
  });
});

describe('TASK-1B.3 project routes — POST /api/projects', () => {
  let store: InMemoryPrisma;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-minimum!!';
    process.env.NODE_ENV = 'development';
    store = new InMemoryPrisma();
  });

  describe('happy path', () => {
    it('returns 201 with ProjectResponse when name is valid', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const token = await registerAndGetAccessToken(app, 'post@example.com', 'Poster');
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: { name: '  My Song  ' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json() as ProjectResponse;
      expect(body.name).toBe('My Song');
      expect(body.id).toEqual(expect.any(String));
      expect(body.songData).toBeDefined();
      expect(body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(body.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      await app.close();
    });

    it('uses INTERFACES Default Song Factory when songData is omitted', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const token = await registerAndGetAccessToken(app, 'default@example.com', 'D');
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: { name: 'Defaulted' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json() as ProjectResponse;
      expectDefaultSongFactoryShape(body.songData);
      await app.close();
    });

    it('persists client-supplied songData when provided', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const token = await registerAndGetAccessToken(app, 'custom@example.com', 'C');
      const custom = minimalCustomSong('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: { name: 'With Data', songData: custom },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json() as ProjectResponse;
      expect(body.songData.metadata.title).toBe('Custom');
      expect(body.songData.metadata.key).toBe('D');
      expect(body.songData.measures).toHaveLength(1);
      await app.close();
    });
  });

  describe('error handling', () => {
    it('returns 400 ValidationError when name is empty after trim', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const token = await registerAndGetAccessToken(app, 'badname@example.com', 'X');
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: { name: '   ' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: { name: expect.any(String) },
      });
      await app.close();
    });

    it('returns 400 ValidationError when songData fails structural validation', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const token = await registerAndGetAccessToken(app, 'badsong@example.com', 'Y');
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: { name: 'Ok', songData: { not: 'a song' } },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      await app.close();
    });
  });
});

describe('TASK-1B.3 project routes — GET /api/projects/:id', () => {
  let store: InMemoryPrisma;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-minimum!!';
    process.env.NODE_ENV = 'development';
    store = new InMemoryPrisma();
  });

  describe('happy path', () => {
    it('returns 200 with ProjectResponse when the project belongs to the caller', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const token = await registerAndGetAccessToken(app, 'owner@example.com', 'O');
      const created = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: { name: 'Mine' },
      });
      const { id } = created.json() as ProjectResponse;

      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as ProjectResponse;
      expect(body.id).toBe(id);
      expect(body.name).toBe('Mine');
      expect(body.songData.version).toBe('1.0');
      await app.close();
    });
  });

  describe('error handling', () => {
    it('returns 404 NotFoundError { code: NOT_FOUND, resource: project } for another user project id', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const tokenA = await registerAndGetAccessToken(app, 'x@example.com', 'X');
      const tokenB = await registerAndGetAccessToken(app, 'y@example.com', 'Y');
      const created = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${tokenB}`,
        },
        payload: { name: 'B project' },
      });
      const id = (created.json() as ProjectResponse).id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NOT_FOUND', resource: 'project' });
      await app.close();
    });

    it('returns 404 NotFoundError for a well-formed uuid that does not exist', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const token = await registerAndGetAccessToken(app, 'solo@example.com', 'S');
      const missingId = '00000000-0000-4000-8000-000000000099';
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${missingId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NOT_FOUND', resource: 'project' });
      await app.close();
    });
  });
});

describe('TASK-1B.3 project routes — PUT /api/projects/:id', () => {
  let store: InMemoryPrisma;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-minimum!!';
    process.env.NODE_ENV = 'development';
    store = new InMemoryPrisma();
  });

  describe('happy path', () => {
    it('returns 200 with updated ProjectResponse when partially updating name', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const token = await registerAndGetAccessToken(app, 'put@example.com', 'P');
      const created = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: { name: 'Original' },
      });
      const { id } = created.json() as ProjectResponse;

      const res = await app.inject({
        method: 'PUT',
        url: `/api/projects/${id}`,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: { name: '  Renamed  ' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as ProjectResponse;
      expect(body.id).toBe(id);
      expect(body.name).toBe('Renamed');
      expect(body.songData.version).toBe('1.0');
      await app.close();
    });
  });

  describe('error handling', () => {
    it('returns 404 NotFoundError when the project id is not found for the user', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const token = await registerAndGetAccessToken(app, 'put404@example.com', 'P');
      const missingId = '00000000-0000-4000-8000-000000000088';
      const res = await app.inject({
        method: 'PUT',
        url: `/api/projects/${missingId}`,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: { name: 'Nope' },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NOT_FOUND', resource: 'project' });
      await app.close();
    });
  });
});

describe('TASK-1B.3 project routes — DELETE /api/projects/:id', () => {
  let store: InMemoryPrisma;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-minimum!!';
    process.env.NODE_ENV = 'development';
    store = new InMemoryPrisma();
  });

  describe('happy path', () => {
    it('returns 204 with an empty body when deleting an owned project', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const token = await registerAndGetAccessToken(app, 'del@example.com', 'D');
      const created = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: { name: 'Trash' },
      });
      const { id } = created.json() as ProjectResponse;

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');

      const get = await app.inject({
        method: 'GET',
        url: `/api/projects/${id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(get.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('error handling', () => {
    it('returns 404 NotFoundError when deleting a non-existent project id', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const token = await registerAndGetAccessToken(app, 'del404@example.com', 'D');
      const missingId = '00000000-0000-4000-8000-000000000077';
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${missingId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NOT_FOUND', resource: 'project' });
      await app.close();
    });
  });
});

describe('TASK-1B.3 project routes — unauthenticated access', () => {
  let store: InMemoryPrisma;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-minimum!!';
    process.env.NODE_ENV = 'development';
    store = new InMemoryPrisma();
  });

  describe('error handling', () => {
    it('returns 401 AuthError { code: UNAUTHORIZED } for GET /api/projects without Bearer token', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const res = await app.inject({ method: 'GET', url: '/api/projects' });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'UNAUTHORIZED' });
      await app.close();
    });

    it('returns 401 AuthError { code: UNAUTHORIZED } for POST /api/projects without Bearer token', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: { 'content-type': 'application/json' },
        payload: { name: 'X' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'UNAUTHORIZED' });
      await app.close();
    });

    it('returns 401 AuthError { code: UNAUTHORIZED } for GET /api/projects/:id without Bearer token', async () => {
      const app = await buildProjectTestApp(asPrismaClient(store));
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/00000000-0000-4000-8000-000000000001',
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'UNAUTHORIZED' });
      await app.close();
    });
  });
});
