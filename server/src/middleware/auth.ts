/**
 * JWT access-token verification for protected routes (full middleware completed in TASK-1B.2).
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

import { isTokenExpiredError, verifyAccessToken } from '../services/authService.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set after successful Bearer JWT verification. */
    auth?: { userId: string; email: string };
  }
}

/**
 * Requires `Authorization: Bearer <accessToken>`. Sets `request.auth` on success.
 * Implemented as async so the hook resolves correctly with Fastify's lifecycle (including `inject()`).
 */
export async function requireAccessToken(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ code: 'UNAUTHORIZED' as const });
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return reply.status(401).send({ code: 'UNAUTHORIZED' as const });
  }
  try {
    request.auth = verifyAccessToken(token);
  } catch (err: unknown) {
    if (isTokenExpiredError(err)) {
      return reply.status(401).send({ code: 'TOKEN_EXPIRED' as const });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return reply.status(401).send({ code: 'UNAUTHORIZED' as const });
    }
    throw err;
  }
}
