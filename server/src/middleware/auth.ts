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
 */
export function requireAccessToken(request: FastifyRequest, reply: FastifyReply): void {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({ code: 'UNAUTHORIZED' as const });
    return;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    reply.status(401).send({ code: 'UNAUTHORIZED' as const });
    return;
  }
  try {
    request.auth = verifyAccessToken(token);
  } catch (err: unknown) {
    if (isTokenExpiredError(err)) {
      reply.status(401).send({ code: 'TOKEN_EXPIRED' as const });
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      reply.status(401).send({ code: 'UNAUTHORIZED' as const });
      return;
    }
    throw err;
  }
}
