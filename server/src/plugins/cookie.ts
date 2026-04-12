import cookie from '@fastify/cookie';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

/**
 * Cookie parsing + signing for httpOnly refresh tokens (auth routes later).
 * PAT-013: use JWT_REFRESH_SECRET when set; local dev fallback only when unset.
 * Wrapped with fastify-plugin so registration matches sibling route plugins.
 */
const DEV_COOKIE_SECRET_FALLBACK = 'dev-only-jwt-refresh-secret-min-32-chars!!';

const cookiePluginImpl: FastifyPluginAsync = async (app) => {
  const secret = process.env.JWT_REFRESH_SECRET ?? DEV_COOKIE_SECRET_FALLBACK;
  await app.register(cookie, {
    secret,
  });
};

export const cookiePlugin = fp(cookiePluginImpl, {
  name: 'vybpad-cookie',
  fastify: '5.x',
});
