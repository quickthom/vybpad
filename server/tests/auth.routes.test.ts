/*
 * QA COVERAGE PLAN — TASK-1B.1
 *
 * POST /api/auth/register (1–7): happy AuthResponse + cookie; UserResponse shape; validation errors;
 *   duplicate email ConflictError.
 * POST /api/auth/login (8–11): happy path + cookie; invalid credentials (wrong password / unknown email).
 * POST /api/auth/refresh (12–15): new access token; rotation cookie; missing/invalid/expired/revoked refresh.
 * POST /api/auth/logout (16–18): 204 with Bearer; clears cookie; 401 without valid access token.
 * Cross-cutting (19–21): error `code` discriminant; JWT claims; bcrypt cost 12 on stored password hash.
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach } from 'vitest';

import type { StoredUser } from './helpers/inMemoryPrisma.js';
import { InMemoryPrisma, asPrismaClient } from './helpers/inMemoryPrisma.js';
import { buildAuthTestApp } from './helpers/buildAuthTestApp.js';

const JWT_SECRET = 'test-jwt-secret-exactly-32-characters!!';

function joinCookieHeader(setCookie: string | string[] | undefined): string {
  if (!setCookie) return '';
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  return parts
    .map((p) => p.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

function expectHasCode(body: unknown): asserts body is { code: string } {
  expect(body).toEqual(expect.objectContaining({ code: expect.any(String) }));
}

describe('TASK-1B.1 auth routes — POST /api/auth/register', () => {
  let store: InMemoryPrisma;

  beforeEach(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-minimum!!';
    process.env.NODE_ENV = 'development';
    store = new InMemoryPrisma();
  });

  describe('happy path', () => {
    it('returns 201 with AuthResponse shape (user + accessToken) on valid registration', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'new@example.com',
          password: 'password123',
          displayName: 'New User',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json() as { user: unknown; accessToken: unknown };
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: 'new@example.com',
          displayName: 'New User',
          createdAt: expect.any(String),
        }),
      );
      await app.close();
    });

    it('returns AuthResponse.user matching UserResponse shape (id, email, displayName, createdAt)', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'shape@example.com',
          password: 'password123',
          displayName: 'Shape',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json() as {
        user: Record<string, unknown>;
        accessToken: string;
      };
      expect(Object.keys(body.user).sort()).toEqual(['createdAt', 'displayName', 'email', 'id'].sort());
      expect(body.user.id).toEqual(expect.any(String));
      expect(body.user.email).toBe('shape@example.com');
      expect(body.user.displayName).toBe('Shape');
      expect(body.user.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      await app.close();
    });

    it('sets httpOnly refreshToken cookie on successful registration', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'cookie@example.com',
          password: 'password123',
          displayName: 'Cookie',
        },
      });
      expect(res.statusCode).toBe(201);
      const raw = res.headers['set-cookie'];
      const joined = Array.isArray(raw) ? raw.join('\n') : String(raw ?? '');
      expect(joined.toLowerCase()).toContain('httponly');
      expect(joined).toMatch(/refreshToken=/);
      await app.close();
    });
  });

  describe('error handling', () => {
    it('returns 400 ValidationError when email is missing', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: { password: 'password123', displayName: 'x' },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json() as { code: string; fields: Record<string, string> };
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.fields).toEqual(expect.objectContaining({}));
      expect(Object.keys(body.fields).length).toBeGreaterThan(0);
      await app.close();
    });

    it('returns 400 ValidationError when password is too short (< 8 chars)', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'short@example.com',
          password: '1234567',
          displayName: 'x',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      await app.close();
    });

    it('returns 400 ValidationError when displayName is empty', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'empty@example.com',
          password: 'password123',
          displayName: '',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      await app.close();
    });

    it('returns 409 ConflictError { code: EMAIL_ALREADY_EXISTS } on duplicate email', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const payload = {
        email: 'dup@example.com',
        password: 'password123',
        displayName: 'One',
      };
      const first = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload,
      });
      expect(first.statusCode).toBe(201);
      const second = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: { ...payload, displayName: 'Two' },
      });
      expect(second.statusCode).toBe(409);
      expect(second.json()).toEqual({ code: 'EMAIL_ALREADY_EXISTS' });
      await app.close();
    });
  });
});

describe('TASK-1B.1 auth routes — POST /api/auth/login', () => {
  let store: InMemoryPrisma;

  beforeEach(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-minimum!!';
    process.env.NODE_ENV = 'development';
    store = new InMemoryPrisma();
  });

  describe('happy path', () => {
    it('returns 200 with AuthResponse shape on valid credentials', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'login@example.com',
          password: 'password123',
          displayName: 'Login',
        },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'login@example.com', password: 'password123' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { user: { id: string; email: string }; accessToken: string };
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user.email).toBe('login@example.com');
      await app.close();
    });

    it('sets httpOnly refreshToken cookie on successful login', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'logcook@example.com',
          password: 'password123',
          displayName: 'LC',
        },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'logcook@example.com', password: 'password123' },
      });
      expect(res.statusCode).toBe(200);
      const raw = res.headers['set-cookie'];
      const joined = Array.isArray(raw) ? raw.join('\n') : String(raw ?? '');
      expect(joined.toLowerCase()).toContain('httponly');
      expect(joined).toMatch(/refreshToken=/);
      await app.close();
    });
  });

  describe('error handling', () => {
    it('returns 401 AuthError INVALID_CREDENTIALS with wrong password', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'wrongpw@example.com',
          password: 'password123',
          displayName: 'W',
        },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'wrongpw@example.com', password: 'not-the-password' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'INVALID_CREDENTIALS' });
      await app.close();
    });

    it('returns 401 AuthError INVALID_CREDENTIALS with non-existent email', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: 'nobody@example.com', password: 'password123' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'INVALID_CREDENTIALS' });
      await app.close();
    });
  });
});

describe('TASK-1B.1 auth routes — POST /api/auth/refresh', () => {
  let store: InMemoryPrisma;

  beforeEach(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-minimum!!';
    process.env.NODE_ENV = 'development';
    store = new InMemoryPrisma();
  });

  describe('happy path', () => {
    it('returns 200 with new accessToken on valid refresh token cookie', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const reg = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'ref@example.com',
          password: 'password123',
          displayName: 'R',
        },
      });
      const regBody = reg.json() as { accessToken: string };
      const cookie = joinCookieHeader(reg.headers['set-cookie']);
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { accessToken: string };
      expect(body.accessToken).toEqual(expect.any(String));
      const prev = jwt.decode(regBody.accessToken) as jwt.JwtPayload;
      const next = jwt.decode(body.accessToken) as jwt.JwtPayload;
      expect(next?.userId).toBe(prev?.userId);
      expect(next?.email).toBe(prev?.email);
      await app.close();
    });

    it('rotates the refresh token (sets new refreshToken cookie)', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const reg = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'rot@example.com',
          password: 'password123',
          displayName: 'R',
        },
      });
      const c1 = joinCookieHeader(reg.headers['set-cookie']);
      const ref = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie: c1 },
      });
      expect(ref.statusCode).toBe(200);
      const c2raw = ref.headers['set-cookie'];
      const c2 = joinCookieHeader(c2raw);
      expect(c2).toMatch(/refreshToken=/);
      const v1 = c1.split('refreshToken=')[1]?.split(';')[0] ?? '';
      const v2 = c2.split('refreshToken=')[1]?.split(';')[0] ?? '';
      expect(v2.length).toBeGreaterThan(0);
      expect(v1).not.toBe(v2);
      await app.close();
    });
  });

  describe('error handling', () => {
    it('returns 401 AuthError INVALID_REFRESH_TOKEN without cookie', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const res = await app.inject({ method: 'POST', url: '/api/auth/refresh' });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'INVALID_REFRESH_TOKEN' });
      await app.close();
    });

    it('returns 401 AuthError INVALID_REFRESH_TOKEN with expired refresh token', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const reg = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'exp@example.com',
          password: 'password123',
          displayName: 'E',
        },
      });
      const cookie = joinCookieHeader(reg.headers['set-cookie']);
      const tokenRow = [...store.refreshById.values()][0];
      expect(tokenRow).toBeDefined();
      tokenRow!.expires_at = new Date(Date.now() - 1000);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'INVALID_REFRESH_TOKEN' });
      await app.close();
    });

    it('returns 401 AuthError INVALID_REFRESH_TOKEN with revoked refresh token (replay after rotation)', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const reg = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'rev@example.com',
          password: 'password123',
          displayName: 'V',
        },
      });
      const c1 = joinCookieHeader(reg.headers['set-cookie']);
      const ref1 = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie: c1 },
      });
      expect(ref1.statusCode).toBe(200);
      const replay = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { cookie: c1 },
      });
      expect(replay.statusCode).toBe(401);
      expect(replay.json()).toEqual({ code: 'INVALID_REFRESH_TOKEN' });
      await app.close();
    });
  });
});

describe('TASK-1B.1 auth routes — POST /api/auth/logout', () => {
  let store: InMemoryPrisma;

  beforeEach(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-minimum!!';
    process.env.NODE_ENV = 'development';
    store = new InMemoryPrisma();
  });

  describe('happy path', () => {
    it('returns 204 on successful logout with valid access token', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const reg = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'out@example.com',
          password: 'password123',
          displayName: 'O',
        },
      });
      const { accessToken } = reg.json() as { accessToken: string };
      const cookie = joinCookieHeader(reg.headers['set-cookie']);
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          authorization: `Bearer ${accessToken}`,
          cookie,
        },
      });
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      await app.close();
    });

    it('clears refreshToken cookie on logout', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const reg = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: {
          email: 'clr@example.com',
          password: 'password123',
          displayName: 'C',
        },
      });
      const { accessToken } = reg.json() as { accessToken: string };
      const cookie = joinCookieHeader(reg.headers['set-cookie']);
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          authorization: `Bearer ${accessToken}`,
          cookie,
        },
      });
      expect(res.statusCode).toBe(204);
      const raw = res.headers['set-cookie'];
      const joined = Array.isArray(raw) ? raw.join('\n') : String(raw ?? '');
      expect(joined).toMatch(/refreshToken=/i);
      const lower = joined.toLowerCase();
      const clears =
        lower.includes('max-age=0') ||
        lower.includes('max-age=0;') ||
        lower.includes('expires=thu, 01 jan 1970');
      expect(clears).toBe(true);
      await app.close();
    });
  });

  describe('error handling', () => {
    it('returns 401 when no valid access token is provided', async () => {
      const app = await buildAuthTestApp(asPrismaClient(store));
      const res = await app.inject({ method: 'POST', url: '/api/auth/logout' });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'UNAUTHORIZED' });
      await app.close();
    });
  });
});

describe('TASK-1B.1 auth routes — cross-cutting contracts', () => {
  let store: InMemoryPrisma;

  beforeEach(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-minimum!!';
    process.env.NODE_ENV = 'development';
    store = new InMemoryPrisma();
  });

  it('includes a string code discriminant on validation, conflict, and auth error responses', async () => {
    const app = await buildAuthTestApp(asPrismaClient(store));

    const v = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: { password: 'password123', displayName: 'x' },
    });
    expectHasCode(v.json());

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: {
        email: 'cross@example.com',
        password: 'password123',
        displayName: 'C',
      },
    });
    const c = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: {
        email: 'cross@example.com',
        password: 'password123',
        displayName: 'D',
      },
    });
    expectHasCode(c.json());

    const a = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'nope@example.com', password: 'password123' },
    });
    expectHasCode(a.json());

    const r = await app.inject({ method: 'POST', url: '/api/auth/refresh' });
    expectHasCode(r.json());

    await app.close();
  });

  it('issues JWT access tokens that verify and contain userId and email claims', async () => {
    const app = await buildAuthTestApp(asPrismaClient(store));
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: {
        email: 'jwt@example.com',
        password: 'password123',
        displayName: 'J',
      },
    });
    const { accessToken, user } = reg.json() as {
      accessToken: string;
      user: { id: string; email: string };
    };
    const decoded = jwt.verify(accessToken, JWT_SECRET) as jwt.JwtPayload & {
      userId?: string;
      email?: string;
    };
    expect(decoded.userId).toBe(user.id);
    expect(decoded.email).toBe(user.email);
    await app.close();
  });

  it('stores bcrypt password hashes at cost factor 12 (never plain text)', async () => {
    const app = await buildAuthTestApp(asPrismaClient(store));
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: {
        email: 'hash@example.com',
        password: 'password123',
        displayName: 'H',
      },
    });
    const uid = store.usersByEmail.get('hash@example.com');
    expect(uid).toBeDefined();
    const row = store.usersById.get(uid!) as StoredUser | undefined;
    expect(row).toBeDefined();
    expect(row!.password_hash).not.toContain('password123');
    expect(bcrypt.getRounds(row!.password_hash)).toBe(12);
    await app.close();
  });
});
