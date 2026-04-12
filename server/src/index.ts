/**
 * Server entry — Fastify 5 + Pino (PAT-006). API routes live under /api per INTERFACES.md.
 */
import '@vybpad/shared';

import { randomUUID } from 'node:crypto';

import Fastify from 'fastify';
import type { FastifyError } from 'fastify';

import { cookiePlugin } from './plugins/cookie.js';
import { corsPlugin } from './plugins/cors.js';
import { prismaPlugin } from './plugins/prisma.js';
import { healthRoutes } from './routes/health.js';

const DEFAULT_PORT = 3001;

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

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      const h = req.headers['x-request-id'];
      const fromHeader = Array.isArray(h) ? h[0] : h;
      return fromHeader ?? randomUUID();
    },
  });

  await app.register(corsPlugin);
  await app.register(cookiePlugin);
  await app.register(prismaPlugin);
  await app.register(healthRoutes, { prefix: '/api' });

  // PAT-001: API errors always expose a `code` discriminant (INTERFACES.md).
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error, reqId: request.id }, 'request failed');

    if (error.validation) {
      return reply.status(error.statusCode ?? 400).send({
        code: 'VALIDATION_ERROR' as const,
        fields: validationFieldsFromFastifyError(error),
      });
    }

    const status = error.statusCode ?? 500;
    const body = {
      code: 'INTERNAL_ERROR' as const,
      ...(isDev() ? { message: error.message } : {}),
    };
    return reply.status(status >= 400 ? status : 500).send(body);
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      code: 'NOT_FOUND' as const,
      resource: 'route',
    });
  });

  const port = Number(process.env.PORT) || DEFAULT_PORT;
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
