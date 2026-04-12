/**
 * Minimal in-memory PrismaClient stand-in for auth route tests (user + refreshToken + $transaction).
 */
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export interface StoredUser {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface StoredRefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

function p2002(message = 'Unique constraint failed'): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code: 'P2002',
    clientVersion: 'mock',
    meta: { target: ['email'] },
  });
}

/**
 * In-memory mock implementing the Prisma surface used by auth routes and authService.
 */
export class InMemoryPrisma {
  readonly usersById = new Map<string, StoredUser>();
  readonly usersByEmail = new Map<string, string>();
  readonly refreshById = new Map<string, StoredRefreshToken>();

  user = {
    create: async (args: {
      data: { email: string; display_name: string; password_hash: string };
    }): Promise<StoredUser> => {
      const email = args.data.email;
      if (this.usersByEmail.has(email)) {
        throw p2002();
      }
      const id = randomUUID();
      const now = new Date();
      const row: StoredUser = {
        id,
        email,
        display_name: args.data.display_name,
        password_hash: args.data.password_hash,
        created_at: now,
        updated_at: now,
      };
      this.usersById.set(id, row);
      this.usersByEmail.set(email, id);
      return row;
    },

    findUnique: async (args: {
      where: { id?: string; email?: string };
    }): Promise<StoredUser | null> => {
      if (args.where.id) {
        return this.usersById.get(args.where.id) ?? null;
      }
      if (args.where.email) {
        const id = this.usersByEmail.get(args.where.email);
        return id ? (this.usersById.get(id) ?? null) : null;
      }
      return null;
    },
  };

  refreshToken = {
    create: async (args: {
      data: {
        id: string;
        user_id: string;
        token_hash: string;
        family_id: string;
        expires_at: Date;
      };
    }): Promise<StoredRefreshToken> => {
      const now = new Date();
      const row: StoredRefreshToken = {
        id: args.data.id,
        user_id: args.data.user_id,
        token_hash: args.data.token_hash,
        family_id: args.data.family_id,
        expires_at: args.data.expires_at,
        revoked_at: null,
        created_at: now,
      };
      this.refreshById.set(row.id, row);
      return row;
    },

    findUnique: async (args: { where: { id: string } }): Promise<StoredRefreshToken | null> => {
      return this.refreshById.get(args.where.id) ?? null;
    },

    update: async (args: {
      where: { id: string };
      data: { revoked_at?: Date | null };
    }): Promise<StoredRefreshToken> => {
      const row = this.refreshById.get(args.where.id);
      if (!row) {
        throw new Error(`refreshToken.update: missing id ${args.where.id}`);
      }
      if (args.data.revoked_at !== undefined) {
        row.revoked_at = args.data.revoked_at;
      }
      return row;
    },

    updateMany: async (args: {
      where: { family_id?: string; user_id?: string; revoked_at: null };
      data: { revoked_at: Date };
    }): Promise<{ count: number }> => {
      let count = 0;
      for (const row of this.refreshById.values()) {
        const matchFamily =
          args.where.family_id === undefined || row.family_id === args.where.family_id;
        const matchUser = args.where.user_id === undefined || row.user_id === args.where.user_id;
        if (matchFamily && matchUser && row.revoked_at === null) {
          row.revoked_at = args.data.revoked_at;
          count += 1;
        }
      }
      return { count };
    },
  };

  async $transaction<T>(fn: (tx: InMemoryPrisma) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

export function asPrismaClient(mock: InMemoryPrisma): PrismaClient {
  return mock as unknown as PrismaClient;
}
