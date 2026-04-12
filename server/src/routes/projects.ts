/**
 * Project CRUD — INTERFACES.md §Project Endpoints, PAT-001 errors, global JWT (TASK-1B.2).
 */
import type { FastifyPluginCallback } from 'fastify';

import type { Prisma } from '@prisma/client';
import type { ProjectResponse, ProjectSummary } from '@vybpad/shared';

import {
  buildDefaultSong,
  findProjectForUser,
  listProjectsForUser,
  normalizeProjectName,
  rowSongDataToModel,
  songDataToJson,
  validateSongData,
} from '../services/projectService.js';

const uuidParamSchema = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', format: 'uuid' },
  },
} as const;

const createBodySchema = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    songData: { type: 'object' },
  },
} as const;

const updateBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: 'string' },
    songData: { type: 'object' },
  },
} as const;

function notFoundProject(reply: { status: (code: number) => { send: (body?: unknown) => unknown } }) {
  return reply.status(404).send({ code: 'NOT_FOUND' as const, resource: 'project' });
}

function toSummary(row: {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toResponse(row: {
  id: string;
  name: string;
  song_data: Prisma.JsonValue;
  created_at: Date;
  updated_at: Date;
}): ProjectResponse {
  return {
    id: row.id,
    name: row.name,
    songData: rowSongDataToModel(row.song_data),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export const projectRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/projects', async (request, reply) => {
    const user = request.user!;
    const rows = await listProjectsForUser(app.prisma, user.userId);
    return reply.status(200).send({ projects: rows.map(toSummary) });
  });

  app.post('/projects', { schema: { body: createBodySchema } }, async (request, reply) => {
    const user = request.user!;
    const body = request.body as { name: string; songData?: unknown };

    const nameResult = normalizeProjectName(body.name);
    if (!nameResult.ok) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR' as const,
        fields: { name: nameResult.message },
      });
    }

    let song: ReturnType<typeof buildDefaultSong>;
    if (body.songData !== undefined) {
      const checked = validateSongData(body.songData);
      if (!checked.ok) {
        return reply.status(400).send({ code: 'VALIDATION_ERROR' as const, fields: checked.fields });
      }
      song = checked.data;
    } else {
      song = buildDefaultSong();
    }

    const row = await app.prisma.project.create({
      data: {
        user_id: user.userId,
        name: nameResult.name,
        song_data: songDataToJson(song),
      },
    });

    app.log.info({ reqId: request.id, userId: user.userId, projectId: row.id }, 'Project created');
    return reply.status(201).send(toResponse(row));
  });

  app.get(
    '/projects/:id',
    { schema: { params: uuidParamSchema } },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const row = await findProjectForUser(app.prisma, user.userId, id);
      if (!row) {
        return notFoundProject(reply);
      }
      return reply.status(200).send(toResponse(row));
    },
  );

  app.put(
    '/projects/:id',
    { schema: { params: uuidParamSchema, body: updateBodySchema } },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const body = request.body as { name?: string; songData?: unknown };

      const existing = await findProjectForUser(app.prisma, user.userId, id);
      if (!existing) {
        return notFoundProject(reply);
      }

      const data: { name?: string; song_data?: ReturnType<typeof songDataToJson> } = {};

      if (body.name !== undefined) {
        const nameResult = normalizeProjectName(body.name);
        if (!nameResult.ok) {
          return reply.status(400).send({
            code: 'VALIDATION_ERROR' as const,
            fields: { name: nameResult.message },
          });
        }
        data.name = nameResult.name;
      }

      if (body.songData !== undefined) {
        const checked = validateSongData(body.songData);
        if (!checked.ok) {
          return reply.status(400).send({ code: 'VALIDATION_ERROR' as const, fields: checked.fields });
        }
        data.song_data = songDataToJson(checked.data);
      }

      const row = await app.prisma.project.update({
        where: { id: existing.id },
        data,
      });

      app.log.info({ reqId: request.id, userId: user.userId, projectId: row.id }, 'Project updated');
      return reply.status(200).send(toResponse(row));
    },
  );

  app.delete(
    '/projects/:id',
    { schema: { params: uuidParamSchema } },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const existing = await findProjectForUser(app.prisma, user.userId, id);
      if (!existing) {
        return notFoundProject(reply);
      }

      await app.prisma.project.delete({ where: { id: existing.id } });
      app.log.info({ reqId: request.id, userId: user.userId, projectId: id }, 'Project deleted');
      return reply.status(204).send();
    },
  );

  done();
};
