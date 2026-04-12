/**
 * Builds a Fastify app with the same auth wiring as production (cookie + error handler + mocked prisma).
 */
import type { FastifyError } from 'fastify';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import { requireAccessToken, shouldSkipApiAuth } from '../../src/middleware/auth.js';
import { cookiePlugin } from '../../src/plugins/cookie.js';
import { authRoutes } from '../../src/routes/auth.js';

function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function validationFieldsFromFastifyError(error: FastifyError): Record<string, string> {
  const fields: Record<string, string> = {};
  const list = error.validation;
  if (!list?.length) {
    return fields;
  }
  for (const issue of list) {
    const missing = issue.params['missingProperty'];
    const key =
      issue.instancePath.replace(/^\//, '') ||
      (typeof missing === 'string' ? missing : issue.keyword);
    fields[key || 'request'] = issue.message ?? 'Invalid value';
  }
  return fields;
}

export async function buildAuthTestApp(prisma: PrismaClient) {
  const app = Fastify({
    logger: false,
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  });

  await app.register(cookiePlugin);
  app.decorate('prisma', prisma);

  // Mirror production (server/src/index.ts): JWT for /api/* except public auth + health.
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

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const isSchemaValidation =
      Boolean(error.validation?.length) || error.code === 'FST_ERR_VALIDATION';
    if (isSchemaValidation) {
      const fields = error.validation?.length
        ? validationFieldsFromFastifyError(error)
        : { request: error.message ?? 'Invalid request' };
      return reply.status(error.statusCode ?? 400).send({
        code: 'VALIDATION_ERROR' as const,
        fields,
      });
    }

    const status = error.statusCode ?? 500;
    const body = {
      code: 'INTERNAL_ERROR' as const,
      ...(isDev() ? { message: error.message } : {}),
    };
    return reply.status(status >= 400 ? status : 500).send(body);
  });

  await app.register(authRoutes, { prefix: '/api' });

  return app;
}
