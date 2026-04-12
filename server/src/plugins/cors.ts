import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

const DEFAULT_ORIGIN = 'http://localhost:5173';

/**
 * PAT-013: CORS_ORIGIN defaults to Vite dev server URL.
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
