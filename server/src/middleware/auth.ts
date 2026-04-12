/**
 * JWT access-token verification for protected /api routes (TASK-1B.2).
 * PAT-001 (error shapes), PAT-006 (logging), PAT-013 (JWT_SECRET).
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

import { isTokenExpiredError, verifyAccessToken } from '../services/authService.js';

/** Authenticated user context attached after Bearer JWT verification. */
export interface AuthUserContext {
  userId: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by global preHandler (or requireAccessToken) after successful Bearer JWT verification. */
    user?: AuthUserContext;
  }
}

/** Routes under /api that do not require Authorization (INTERFACES.md, TASK-1B.2). */
export function shouldSkipApiAuth(method: string, pathname: string): boolean {
  const p = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (method === 'GET' && p === '/api/health') return true;
  if (method === 'POST' && p === '/api/auth/register') return true;
  if (method === 'POST' && p === '/api/auth/login') return true;
  if (method === 'POST' && p === '/api/auth/refresh') return true;
  return false;
}

/**
 * Requires `Authorization: Bearer <accessToken>`. Sets `request.user` on success.
 * On failure, sends 401 with AuthError body and leaves `reply.sent` true.
 */
export function requireAccessToken(request: FastifyRequest, reply: FastifyReply): void {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    request.log.info({ reqId: request.id }, 'Missing or non-Bearer Authorization header');
    reply.status(401).send({ code: 'UNAUTHORIZED' as const });
    return;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    request.log.info({ reqId: request.id }, 'Empty Bearer token');
    reply.status(401).send({ code: 'UNAUTHORIZED' as const });
    return;
  }
  try {
    request.user = verifyAccessToken(token);
  } catch (err: unknown) {
    if (isTokenExpiredError(err)) {
      request.log.warn({ reqId: request.id }, 'Access token expired');
      reply.status(401).send({ code: 'TOKEN_EXPIRED' as const });
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      request.log.info({ reqId: request.id }, 'Invalid access JWT');
      reply.status(401).send({ code: 'UNAUTHORIZED' as const });
      return;
    }
    throw err;
  }
}
