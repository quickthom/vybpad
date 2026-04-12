/*
 * QA COVERAGE PLAN — TASK-1B.2
 *
 * Criterion 1: Middleware reads Authorization header (Bearer <token>)
 *   happy: Bearer token parsed and verified
 *   error: missing / non-Bearer / empty token → UNAUTHORIZED
 *   edges: whitespace around token after "Bearer "
 *
 * Criterion 2: Valid JWT → request proceeds; user has userId and email
 *   happy: protected route returns user payload from JWT
 *   error: N/A
 *   edges: N/A
 *
 * Criterion 3–5: Auth errors
 *   missing header → 401 { code: UNAUTHORIZED }
 *   invalid/malformed → 401 { code: UNAUTHORIZED }
 *   expired → 401 { code: TOKEN_EXPIRED }
 *
 * Criterion 6: Exempt routes (register, login, refresh, health) — no auth gate
 * Criterion 7: Protected /api/* sample route requires auth
 * Criterion 8: FastifyRequest.user typing (runtime shape + type-level)
 * Criterion 9: Error bodies match INTERFACES.md AuthError
 * Criterion 10: monorepo TypeScript build passes (verified via npm run build)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import type { FastifyRequest } from 'fastify';

import { requireAccessToken, shouldSkipApiAuth } from '../src/middleware/auth.js';
import { healthRoutes } from '../src/routes/health.js';
import { signAccessToken } from '../src/services/authService.js';

const TEST_JWT_SECRET = 'x'.repeat(32);

/** Minimal app mirroring `server/src/index.ts` global preHandler + sample routes. */
async function buildTestApp() {
  const app = Fastify({ logger: false });

  app.addHook('preHandler', (request, reply, done) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/api') || shouldSkipApiAuth(request.method, pathname)) {
      done();
      return;
    }
    requireAccessToken(request, reply);
    if (reply.sent) {
      return;
    }
    done();
  });

  await app.register(healthRoutes, { prefix: '/api' });

  app.post('/api/auth/register', async () => ({ stub: true }));
  app.post('/api/auth/login', async () => ({ stub: true }));
  app.post('/api/auth/refresh', async () => ({ stub: true }));

  app.get('/api/projects/probe', async (request) => ({
    user: request.user,
  }));

  await app.ready();
  return app;
}

describe('Auth middleware (TASK-1B.2) — Bearer token and Authorization header', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('happy path', () => {
    it('allows the request when Authorization is Bearer <valid JWT> and attaches userId and email to the request', async () => {
      const app = await buildTestApp();
      const token = signAccessToken('11111111-1111-4111-8111-111111111111', 'user@example.com');
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/probe',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as { user?: { userId: string; email: string } };
      expect(body.user).toEqual({
        userId: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
      });
      await app.close();
    });
  });

  describe('error handling', () => {
    it('returns 401 with AuthError { code: UNAUTHORIZED } when the Authorization header is missing', async () => {
      const app = await buildTestApp();
      const res = await app.inject({ method: 'GET', url: '/api/projects/probe' });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body)).toEqual({ code: 'UNAUTHORIZED' });
      await app.close();
    });

    it('returns 401 with AuthError { code: UNAUTHORIZED } when Authorization is not a Bearer token', async () => {
      const app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/probe',
        headers: { authorization: 'Basic abc' },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body)).toEqual({ code: 'UNAUTHORIZED' });
      await app.close();
    });

    it('returns 401 with AuthError { code: UNAUTHORIZED } when the Bearer token is empty', async () => {
      const app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/probe',
        headers: { authorization: 'Bearer   ' },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body)).toEqual({ code: 'UNAUTHORIZED' });
      await app.close();
    });

    it('returns 401 with AuthError { code: UNAUTHORIZED } when the JWT is malformed or invalid', async () => {
      const app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/probe',
        headers: { authorization: 'Bearer not-a-valid-jwt' },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body)).toEqual({ code: 'UNAUTHORIZED' });
      await app.close();
    });

    it('returns 401 with AuthError { code: TOKEN_EXPIRED } when the JWT is expired', async () => {
      const app = await buildTestApp();
      const expired = jwt.sign(
        { userId: '22222222-2222-4222-8222-222222222222', email: 'exp@example.com' },
        TEST_JWT_SECRET,
        { expiresIn: '-1h' },
      );
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/probe',
        headers: { authorization: `Bearer ${expired}` },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body)).toEqual({ code: 'TOKEN_EXPIRED' });
      await app.close();
    });
  });

  describe('edge cases', () => {
    it('trims leading whitespace after Bearer and still accepts a valid token', async () => {
      const app = await buildTestApp();
      const token = signAccessToken('33333333-3333-4333-8333-333333333333', 'trim@example.com');
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/probe',
        headers: { authorization: `Bearer  ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as { user?: { userId: string; email: string } };
      expect(body.user?.email).toBe('trim@example.com');
      await app.close();
    });
  });
});

describe('Auth middleware (TASK-1B.2) — route exemptions and coverage', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('happy path', () => {
    it('does not require auth for GET /api/health', async () => {
      const app = await buildTestApp();
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
      await app.close();
    });

    it('does not require auth for POST /api/auth/register', async () => {
      const app = await buildTestApp();
      const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: {} });
      expect(res.statusCode).not.toBe(401);
      await app.close();
    });

    it('does not require auth for POST /api/auth/login', async () => {
      const app = await buildTestApp();
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} });
      expect(res.statusCode).not.toBe(401);
      await app.close();
    });

    it('does not require auth for POST /api/auth/refresh', async () => {
      const app = await buildTestApp();
      const res = await app.inject({ method: 'POST', url: '/api/auth/refresh', payload: {} });
      expect(res.statusCode).not.toBe(401);
      await app.close();
    });

    it('requires auth for a non-exempt /api route such as GET /api/projects/probe', async () => {
      const app = await buildTestApp();
      const res = await app.inject({ method: 'GET', url: '/api/projects/probe' });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body)).toEqual({ code: 'UNAUTHORIZED' });
      await app.close();
    });
  });
});

describe('Auth middleware (TASK-1B.2) — FastifyRequest.user type extension', () => {
  it('augments FastifyRequest with optional user { userId, email } (module augmentation from auth.ts)', async () => {
    await import('../src/middleware/auth.js');
    const snapshot = (req: FastifyRequest) => ({
      userId: req.user?.userId,
      email: req.user?.email,
    });
    expect(
      snapshot({
        user: { userId: '44444444-4444-4444-8444-444444444444', email: 'typed@example.com' },
      } as FastifyRequest),
    ).toEqual({
      userId: '44444444-4444-4444-8444-444444444444',
      email: 'typed@example.com',
    });
  });
});

describe('shouldSkipApiAuth — path normalization', () => {
  it('treats trailing slash paths like /api/health/ as equivalent for exemption', () => {
    expect(shouldSkipApiAuth('GET', '/api/health/')).toBe(true);
  });
});
