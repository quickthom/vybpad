import { PrismaClient } from '@prisma/client';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

/**
 * PAT-013: DATABASE_URL is read by Prisma from the environment.
 * Disconnect on close so the process can exit cleanly during dev reload / shutdown.
 */
const prismaPluginImpl: FastifyPluginAsync = (app) => {
  const prisma = new PrismaClient();
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
  return Promise.resolve();
};

export const prismaPlugin = fp(prismaPluginImpl, {
  name: 'vybpad-prisma',
  fastify: '5.x',
});
