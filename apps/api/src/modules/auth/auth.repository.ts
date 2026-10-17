import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';

const userSelect = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  organizationId: true,
  orgRole: true,
  failedLoginCount: true,
  lockedUntil: true,
  mustChangePassword: true,
  deletedAt: true,
} as const;

export type AuthUserRecord = NonNullable<Awaited<ReturnType<typeof findUserByEmail>>>;

export interface SessionRecord {
  id: string;
  familyId: string;
  userId: string;
  organizationId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface NewSession {
  tokenHash: string;
  familyId: string;
  userId: string;
  organizationId: string;
  expiresAt: Date;
  userAgent?: string | undefined;
  ip?: string | undefined;
}

export async function findUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email, deletedAt: null }, select: userSelect });
}

export async function findUserById(id: string) {
  return prisma.user.findFirst({ where: { id, deletedAt: null }, select: userSelect });
}

/** Increments the failure counter and returns the new count. */
export async function incrementFailedLogins(
  userId: string,
  db: DbClient = prisma,
): Promise<number> {
  const user = await db.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  });
  return user.failedLoginCount;
}

export async function lockUser(userId: string, until: Date, db: DbClient = prisma): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { lockedUntil: until, failedLoginCount: 0 },
  });
}

export async function resetFailedLogins(userId: string, db: DbClient = prisma): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
}

export async function createSession(data: NewSession, db: DbClient = prisma): Promise<void> {
  await db.refreshSession.create({
    data: {
      tokenHash: data.tokenHash,
      familyId: data.familyId,
      userId: data.userId,
      organizationId: data.organizationId,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent ?? null,
      ip: data.ip ?? null,
    },
  });
}

export async function findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
  return prisma.refreshSession.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      familyId: true,
      userId: true,
      organizationId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
}

/** Atomically revokes a session that is still active. Returns false if it was already revoked. */
export async function revokeSessionIfActive(
  sessionId: string,
  now: Date,
  db: DbClient = prisma,
): Promise<boolean> {
  const result = await db.refreshSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: now },
  });
  return result.count === 1;
}

/** True while the family still has an unrevoked, unexpired refresh session. */
export async function isFamilyActive(familyId: string, now: Date): Promise<boolean> {
  const count = await prisma.refreshSession.count({
    where: { familyId, revokedAt: null, expiresAt: { gt: now } },
  });
  return count > 0;
}

export async function revokeFamily(
  familyId: string,
  now: Date,
  db: DbClient = prisma,
): Promise<void> {
  await db.refreshSession.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: now },
  });
}

/** Stores a new password hash and clears any lockout so the user can sign in with it. */
export async function updatePassword(
  userId: string,
  passwordHash: string,
  mustChangePassword: boolean,
  db: DbClient = prisma,
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword, failedLoginCount: 0, lockedUntil: null },
  });
}

export async function revokeAllSessions(
  userId: string,
  now: Date,
  db: DbClient = prisma,
): Promise<void> {
  await db.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
}
