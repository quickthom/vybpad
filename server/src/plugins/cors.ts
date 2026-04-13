import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

/** Align with `playwright.config` / `e2e:devstack` (127.0.0.1) so CORS matches the browser `Origin` header. */
const DEFAULT_ORIGIN = 'http://127.0.0.1:5173';

/**
 * PAT-013: CORS_ORIGIN defaults to the Vite dev server origin (see `.env.example` / Playwright).
 * Wrapped with fastify-plugin so hooks apply to all routes (Fastify encapsulation).
 */
const corsPluginImpl: FastifyPluginAsync = async (app) => {
  const allowOrigin = process.env.CORS_ORIGIN ?? DEFAULT_ORIGIN;
  await app.register(cors, {
    origin: allowOrigin,
    credentials: true,
  });
};

export const corsPlugin = fp(corsPluginImpl, {
  name: 'vybpad-cors',
  fastify: '5.x',
});
