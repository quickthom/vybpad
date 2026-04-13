/**
 * TASK-3.5 remediation: @fastify/cors default methods omit PUT — browsers then block credentialed saves.
 */
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { corsPlugin } from '../src/plugins/cors.js';

describe('corsPlugin — preflight for project API verbs', () => {
  it('includes PUT in Access-Control-Allow-Methods so credentialed PUT /api/projects/:id is not blocked', async () => {
    const app = Fastify({ logger: false });
    await app.register(corsPlugin);
    await app.get('/api/health', async () => ({ ok: true }));

    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'PUT',
      },
    });

    expect(res.statusCode).toBe(204);
    const allowMethods = res.headers['access-control-allow-methods'];
    expect(allowMethods).toBeDefined();
    expect(String(allowMethods)).toMatch(/PUT/);
    expect(String(allowMethods)).toMatch(/DELETE/);
  });
});
