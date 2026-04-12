/**
 * Auth HTTP routes — INTERFACES.md §Auth Endpoints, PAT-001 error shapes, PAT-006 logging.
 */
import { Prisma } from '@prisma/client';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';

import { requireAccessToken } from '../middleware/auth.js';
import {
  parseRefreshOpaque,
  registerUser,
  revokeAllRefreshTokensForUser,
  revokeFamilyTokens,
  rotateRefreshToken,
  toUserResponse,
  verifyLogin,
} from '../services/authService.js';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_MAX_AGE_SEC = 604800;

function refreshCookieOpts(): {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict';
  signed: boolean;
} {
  return {
    path: '/api/auth',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    signed: true,
  };
}

function setRefreshCookie(reply: FastifyReply, opaque: string): void {
  reply.setCookie(REFRESH_COOKIE, opaque, {
    ...refreshCookieOpts(),
    maxAge: REFRESH_MAX_AGE_SEC,
  });
}

function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, refreshCookieOpts());
}

export const authRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const registerSchema = {
    body: {
      type: 'object',
      required: ['email', 'password', 'displayName'],
      additionalProperties: false,
      properties: {
        email: { type: 'string', format: 'email', maxLength: 255 },
        password: { type: 'string', minLength: 8, maxLength: 128 },
        displayName: { type: 'string', minLength: 1, maxLength: 50 },
      },
    },
  } as const;

  const loginSchema = {
    body: {
      type: 'object',
      required: ['email', 'password'],
      additionalProperties: false,
      properties: {
        email: { type: 'string', format: 'email', maxLength: 255 },
        password: { type: 'string', minLength: 1, maxLength: 128 },
      },
    },
  } as const;

  app.post('/auth/register', { schema: registerSchema }, async (request, reply) => {
    const body = request.body as { email: string; password: string; displayName: string };
    const email = body.email.trim().toLowerCase();
    const displayName = body.displayName.trim();
    if (displayName.length < 1 || displayName.length > 50) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR' as const,
        fields: { displayName: 'Must be 1–50 characters after trimming' },
      });
    }

    try {
      const { user, accessToken, refreshOpaque } = await registerUser(app.prisma, {
        email,
        password: body.password,
        displayName,
      });
      setRefreshCookie(reply, refreshOpaque);
      app.log.info({ reqId: request.id, userId: user.id }, 'User registered');
      return reply.status(201).send({
        user: toUserResponse(user),
        accessToken,
      });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.status(409).send({ code: 'EMAIL_ALREADY_EXISTS' as const });
      }
      throw err;
    }
  });

  app.post('/auth/login', { schema: loginSchema }, async (request, reply) => {
    const body = request.body as { email: string; password: string };
    const email = body.email.trim().toLowerCase();
    const result = await verifyLogin(app.prisma, { email, password: body.password });
    if (!result) {
      app.log.info({ reqId: request.id }, 'Login failed (invalid credentials)');
      return reply.status(401).send({ code: 'INVALID_CREDENTIALS' as const });
    }
    const { user, accessToken, refreshOpaque } = result;
    setRefreshCookie(reply, refreshOpaque);
    app.log.info({ reqId: request.id, userId: user.id }, 'User logged in');
    return reply.status(200).send({
      user: toUserResponse(user),
      accessToken,
    });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const raw = request.cookies[REFRESH_COOKIE];
    if (!raw) {
      return reply.status(401).send({ code: 'INVALID_REFRESH_TOKEN' as const });
    }
    const unsigned = request.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) {
      return reply.status(401).send({ code: 'INVALID_REFRESH_TOKEN' as const });
    }

    const outcome = await rotateRefreshToken(app.prisma, unsigned.value, app.log);
    if (outcome.status !== 'ok') {
      return reply.status(401).send({ code: 'INVALID_REFRESH_TOKEN' as const });
    }

    setRefreshCookie(reply, outcome.opaque);
    app.log.info({ reqId: request.id }, 'Access token refreshed');
    return reply.status(200).send({ accessToken: outcome.accessToken });
  });

  app.post('/auth/logout', { preHandler: requireAccessToken }, async (request, reply) => {
    const auth = request.auth!;
    const raw = request.cookies[REFRESH_COOKIE];
    let revokedFamily = false;

    if (raw) {
      const unsigned = request.unsignCookie(raw);
      if (unsigned.valid && unsigned.value) {
        const parsed = parseRefreshOpaque(unsigned.value);
        if (parsed) {
          const row = await app.prisma.refreshToken.findUnique({
            where: { id: parsed.id },
          });
          if (row && row.user_id === auth.userId) {
            await revokeFamilyTokens(app.prisma, row.family_id);
            revokedFamily = true;
          }
        }
      }
    }

    if (!revokedFamily) {
      await revokeAllRefreshTokensForUser(app.prisma, auth.userId);
    }

    clearRefreshCookie(reply);
    app.log.info({ reqId: request.id, userId: auth.userId }, 'User logged out');
    return reply.status(204).send();
  });

  done();
};
