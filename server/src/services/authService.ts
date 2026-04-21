/**
 * Auth business logic: bcrypt passwords, JWT access tokens, opaque refresh tokens (INTERFACES.md §Auth).
 * Refresh tokens use row id + secret (lookup by PK); stored value is bcrypt-hashed (ARCHITECTURE.md §Auth Strategy).
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

import type { Prisma, PrismaClient, User } from '@prisma/client';

const BCRYPT_ROUNDS = 12;
const REFRESH_MAX_AGE_SEC = 604800;
const ACCESS_EXPIRES: jwt.SignOptions['expiresIn'] = '15m';

export type DbClient = PrismaClient | Prisma.TransactionClient;

function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters (PAT-013)');
  }
  return s;
}

export interface UserResponseShape {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export function toUserResponse(user: {
  id: string;
  email: string;
  display_name: string;
  created_at: Date;
}): UserResponseShape {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    createdAt: user.created_at.toISOString(),
  };
}

export function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, getJwtSecret(), { expiresIn: ACCESS_EXPIRES });
}

export function verifyAccessToken(token: string): { userId: string; email: string } {
  const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload & {
    userId?: unknown;
    email?: unknown;
  };
  if (typeof decoded.userId !== 'string' || typeof decoded.email !== 'string') {
    throw new jwt.JsonWebTokenError('invalid payload');
  }
  return { userId: decoded.userId, email: decoded.email };
}

export function isTokenExpiredError(err: unknown): boolean {
  return err instanceof jwt.TokenExpiredError;
}

/** Opaque refresh cookie value: `${rowId}.${secret}` — both UUID v4 (no dots inside). */
export function parseRefreshOpaque(opaque: string): { id: string; secret: string } | null {
  const dot = opaque.indexOf('.');
  if (dot <= 0 || dot === opaque.length - 1) return null;
  const id = opaque.slice(0, dot);
  const secret = opaque.slice(dot + 1);
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id) || !uuidRe.test(secret)) return null;
  return { id, secret };
}

export async function insertRefreshToken(
  db: DbClient,
  userId: string,
  familyId: string,
): Promise<{ opaque: string; expiresAt: Date }> {
  const tokenRowId = randomUUID();
  const secret = randomUUID();
  const opaque = `${tokenRowId}.${secret}`;
  const token_hash = await bcrypt.hash(opaque, BCRYPT_ROUNDS);
  const expires_at = new Date(Date.now() + REFRESH_MAX_AGE_SEC * 1000);
  await db.refreshToken.create({
    data: {
      id: tokenRowId,
      user_id: userId,
      token_hash,
      family_id: familyId,
      expires_at,
    },
  });
  return { opaque, expiresAt: expires_at };
}

export async function registerUser(
  prisma: PrismaClient,
  params: { email: string; password: string; displayName: string },
): Promise<{ user: User; accessToken: string; refreshOpaque: string }> {
  const password_hash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);
  const familyId = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: params.email,
      display_name: params.displayName,
      password_hash,
    },
  });
  const { opaque } = await insertRefreshToken(prisma, user.id, familyId);
  const accessToken = signAccessToken(user.id, user.email);
  return { user, accessToken, refreshOpaque: opaque };
}

export async function verifyLogin(
  prisma: PrismaClient,
  params: { email: string; password: string },
): Promise<{ user: User; accessToken: string; refreshOpaque: string } | null> {
  const user = await prisma.user.findUnique({
    where: { email: params.email },
  });
  if (!user) return null;
  const ok = await bcrypt.compare(params.password, user.password_hash);
  if (!ok) return null;
  const familyId = randomUUID();
  const { opaque } = await insertRefreshToken(prisma, user.id, familyId);
  const accessToken = signAccessToken(user.id, user.email);
  return { user, accessToken, refreshOpaque: opaque };
}

export async function revokeFamilyTokens(db: DbClient, familyId: string): Promise<void> {
  const now = new Date();
  await db.refreshToken.updateMany({
    where: { family_id: familyId, revoked_at: null },
    data: { revoked_at: now },
  });
}

export async function revokeAllRefreshTokensForUser(db: DbClient, userId: string): Promise<void> {
  const now = new Date();
  await db.refreshToken.updateMany({
    where: { user_id: userId, revoked_at: null },
    data: { revoked_at: now },
  });
}

export type RotateRefreshOutcome =
  | { status: 'ok'; accessToken: string; opaque: string; expiresAt: Date }
  | { status: 'invalid' };

/**
 * Validates refresh opaque, rotates token in the same family, returns new access JWT.
 * Replay of a revoked token revokes the whole family (detected theft), then returns invalid.
 */
export async function rotateRefreshToken(
  prisma: PrismaClient,
  opaque: string,
  log: { warn: (o: Record<string, unknown>, msg?: string) => void },
): Promise<RotateRefreshOutcome> {
  const parsed = parseRefreshOpaque(opaque);
  if (!parsed) return { status: 'invalid' };

  const row = await prisma.refreshToken.findUnique({
    where: { id: parsed.id },
  });
  if (!row) return { status: 'invalid' };

  const now = new Date();

  if (row.revoked_at) {
    await revokeFamilyTokens(prisma, row.family_id);
    log.warn({ familyId: row.family_id }, 'Refresh token replay (revoked token presented)');
    return { status: 'invalid' };
  }

  if (row.expires_at <= now) {
    return { status: 'invalid' };
  }

  const matches = await bcrypt.compare(opaque, row.token_hash);
  if (!matches) return { status: 'invalid' };

  const user = await prisma.user.findUnique({ where: { id: row.user_id } });
  if (!user) return { status: 'invalid' };

  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: row.id },
      data: { revoked_at: now },
    });
    const { opaque: newOpaque, expiresAt } = await insertRefreshToken(
      tx,
      row.user_id,
      row.family_id,
    );
    const accessToken = signAccessToken(user.id, user.email);
    return { status: 'ok' as const, accessToken, opaque: newOpaque, expiresAt };
  });
}
