import { randomUUID } from 'node:crypto';
import type { ChangePasswordInput, OrgRole, UserDto } from '@brd/shared';
import { env } from '../../config/env.js';
import { UnauthorizedError, ValidationError } from '../../errors/app-error.js';
import { signAccessToken } from '../../lib/jwt.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../lib/password.js';
import { generateOpaqueToken, hashToken } from '../../lib/tokens.js';
import { withTransaction, type DbClient } from '../../lib/transaction.js';
import { createAuditLog } from '../audit/audit.repository.js';
import * as repo from './auth.repository.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_REFRESH = 'Invalid refresh token';

export interface RequestContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface AuthResult {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

export function toUserDto(user: {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  orgRole: OrgRole;
  mustChangePassword: boolean;
}): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
    orgRole: user.orgRole,
    mustChangePassword: user.mustChangePassword,
    role: { id: user.orgRole, name: user.orgRole },
  };
}

async function issueSession(
  user: repo.AuthUserRecord,
  familyId: string,
  ctx: RequestContext,
  db: DbClient,
): Promise<AuthResult> {
  const refreshToken = generateOpaqueToken();
  await repo.createSession(
    {
      tokenHash: hashToken(refreshToken),
      familyId,
      userId: user.id,
      organizationId: user.organizationId,
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_EXPIRY_SECONDS * 1000),
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    },
    db,
  );
  const accessToken = await signAccessToken({
    userId: user.id,
    organizationId: user.organizationId,
    orgRole: user.orgRole,
  });
  return { user: toUserDto(user), accessToken, refreshToken, csrfToken: generateOpaqueToken() };
}

async function recordFailedLogin(
  email: string,
  reason: 'unknown_user' | 'locked' | 'bad_password',
  ctx: RequestContext,
  user?: repo.AuthUserRecord,
): Promise<void> {
  await withTransaction(async (tx) => {
    if (user && reason === 'bad_password') {
      const failures = await repo.incrementFailedLogins(user.id, tx);
      if (failures >= MAX_FAILED_LOGINS) {
        await repo.lockUser(user.id, new Date(Date.now() + LOCKOUT_MS), tx);
      }
    }
    await createAuditLog(
      {
        action: 'LOGIN_FAILURE',
        entity: 'Auth',
        userId: user?.id ?? null,
        organizationId: user?.organizationId ?? null,
        metadata: { reason, emailHash: hashToken(email), ip: ctx.ip ?? null },
      },
      tx,
    );
  });
}

export async function login(
  email: string,
  password: string,
  ctx: RequestContext,
): Promise<AuthResult> {
  const user = await repo.findUserByEmail(email);

  if (!user) {
    await verifyAgainstDummy(password);
    await recordFailedLogin(email, 'unknown_user', ctx);
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await verifyAgainstDummy(password);
    await recordFailedLogin(email, 'locked', ctx, user);
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    await recordFailedLogin(email, 'bad_password', ctx, user);
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }

  return withTransaction(async (tx) => {
    await repo.resetFailedLogins(user.id, tx);
    const result = await issueSession(user, randomUUID(), ctx, tx);
    await createAuditLog(
      {
        action: 'LOGIN_SUCCESS',
        entity: 'Auth',
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { ip: ctx.ip ?? null },
      },
      tx,
    );
    return result;
  });
}

async function revokeFamilyWithAudit(
  session: repo.SessionRecord,
  ctx: RequestContext,
): Promise<void> {
  await withTransaction(async (tx) => {
    await repo.revokeFamily(session.familyId, new Date(), tx);
    await createAuditLog(
      {
        action: 'TOKEN_REUSE_DETECTED',
        entity: 'RefreshSession',
        entityId: session.id,
        userId: session.userId,
        organizationId: session.organizationId,
        metadata: { familyId: session.familyId, ip: ctx.ip ?? null },
      },
      tx,
    );
  });
}

export async function refresh(rawToken: string, ctx: RequestContext): Promise<AuthResult> {
  const session = await repo.findSessionByTokenHash(hashToken(rawToken));
  if (!session) {
    throw new UnauthorizedError(INVALID_REFRESH);
  }

  // A rotated token being replayed means it was stolen: kill the whole family.
  if (session.revokedAt) {
    await revokeFamilyWithAudit(session, ctx);
    throw new UnauthorizedError(INVALID_REFRESH);
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    throw new UnauthorizedError(INVALID_REFRESH);
  }

  const user = await repo.findUserById(session.userId);
  if (!user) {
    await repo.revokeFamily(session.familyId, new Date());
    throw new UnauthorizedError(INVALID_REFRESH);
  }

  const rotated = await withTransaction(async (tx) => {
    const won = await repo.revokeSessionIfActive(session.id, new Date(), tx);
    return won ? issueSession(user, session.familyId, ctx, tx) : null;
  });

  if (!rotated) {
    await revokeFamilyWithAudit(session, ctx);
    throw new UnauthorizedError(INVALID_REFRESH);
  }
  return rotated;
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const session = await repo.findSessionByTokenHash(hashToken(rawToken));
  if (!session) return;

  await withTransaction(async (tx) => {
    await repo.revokeFamily(session.familyId, new Date(), tx);
    await createAuditLog(
      {
        action: 'LOGOUT',
        entity: 'RefreshSession',
        entityId: session.id,
        userId: session.userId,
        organizationId: session.organizationId,
      },
      tx,
    );
  });
}

/**
 * Replaces the caller's password. Every existing session is revoked and a fresh one is issued,
 * so other devices are signed out while the caller stays signed in.
 */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  ctx: RequestContext,
): Promise<AuthResult> {
  const user = await repo.findUserById(userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    // Counts toward the lockout so a stolen session cannot guess the current password.
    await recordFailedLogin(user.email, 'bad_password', ctx, user);
    throw new ValidationError('Current password is incorrect');
  }

  const passwordHash = await hashPassword(input.newPassword);
  return withTransaction(async (tx) => {
    await repo.updatePassword(user.id, passwordHash, false, tx);
    await repo.revokeAllSessions(user.id, new Date(), tx);
    const result = await issueSession(
      { ...user, mustChangePassword: false },
      randomUUID(),
      ctx,
      tx,
    );
    await createAuditLog(
      {
        action: 'UPDATE',
        entity: 'UserPassword',
        entityId: user.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { ip: ctx.ip ?? null },
      },
      tx,
    );
    return result;
  });
}

/** Loads the live user for an authenticated request; deleted users are rejected immediately. */
export async function getSessionUser(userId: string): Promise<UserDto> {
  const user = await repo.findUserById(userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  return toUserDto(user);
}
