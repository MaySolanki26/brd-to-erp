import type {
  CreateUserInput,
  OrgUserDto,
  ResetPasswordInput,
  UpdateUserInput,
  UserDto,
} from '@brd/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../../errors/app-error.js';
import { hashPassword } from '../../lib/password.js';
import { withTransaction } from '../../lib/transaction.js';
import { createAuditLog } from '../audit/audit.repository.js';
import * as authRepo from '../auth/auth.repository.js';
import * as repo from './users.repository.js';

const SELF_CHANGE = 'You cannot change your own role or deactivate yourself';
const LAST_ADMIN = 'At least one active organization admin is required';

export function toOrgUserDto(user: repo.OrgUserRecord): OrgUserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    orgRole: user.orgRole,
    active: user.deletedAt === null,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
  };
}

async function requireUser(actor: UserDto, userId: string): Promise<repo.OrgUserRecord> {
  const user = await repo.findUser(actor.organizationId, userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
}

export async function listUsers(actor: UserDto): Promise<OrgUserDto[]> {
  const users = await repo.listUsers(actor.organizationId);
  return users.map(toOrgUserDto);
}

export async function createUser(actor: UserDto, input: CreateUserInput): Promise<OrgUserDto> {
  if (await repo.emailTaken(input.email)) {
    throw new ConflictError('A user with this email already exists');
  }
  const passwordHash = await hashPassword(input.tempPassword);

  return withTransaction(async (tx) => {
    const user = await repo.createUser(
      {
        organizationId: actor.organizationId,
        email: input.email,
        name: input.name,
        orgRole: input.orgRole,
        passwordHash,
      },
      tx,
    );
    await createAuditLog(
      {
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
        userId: actor.id,
        organizationId: actor.organizationId,
        metadata: { orgRole: user.orgRole },
      },
      tx,
    );
    return toOrgUserDto(user);
  });
}

export async function updateUser(
  actor: UserDto,
  userId: string,
  input: UpdateUserInput,
): Promise<OrgUserDto> {
  const target = await requireUser(actor, userId);
  const wasActive = target.deletedAt === null;
  const nextRole = input.orgRole ?? target.orgRole;
  const nextActive = input.active ?? wasActive;

  if (target.id === actor.id && (nextRole !== target.orgRole || !nextActive)) {
    throw new ForbiddenError(SELF_CHANGE);
  }
  const removesAdmin =
    wasActive && target.orgRole === 'ORG_ADMIN' && (nextRole !== 'ORG_ADMIN' || !nextActive);

  return withTransaction(async (tx) => {
    if (removesAdmin && (await repo.countActiveAdmins(actor.organizationId, tx)) <= 1) {
      throw new ConflictError(LAST_ADMIN);
    }
    const updated = await repo.updateUser(
      target.id,
      {
        orgRole: nextRole,
        ...(nextActive !== wasActive && { deletedAt: nextActive ? null : new Date() }),
      },
      tx,
    );
    if (wasActive && !nextActive) {
      await authRepo.revokeAllSessions(target.id, new Date(), tx);
    }
    await createAuditLog(
      {
        action: 'UPDATE',
        entity: 'User',
        entityId: target.id,
        userId: actor.id,
        organizationId: actor.organizationId,
        metadata: { orgRole: nextRole, active: nextActive },
      },
      tx,
    );
    return toOrgUserDto(updated);
  });
}

export async function resetPassword(
  actor: UserDto,
  userId: string,
  input: ResetPasswordInput,
): Promise<OrgUserDto> {
  const target = await requireUser(actor, userId);
  if (target.id === actor.id) {
    throw new ForbiddenError('Use change password to update your own password');
  }
  if (target.deletedAt !== null) {
    throw new ConflictError('Reactivate the user before resetting their password');
  }
  const passwordHash = await hashPassword(input.tempPassword);

  return withTransaction(async (tx) => {
    await authRepo.updatePassword(target.id, passwordHash, true, tx);
    await authRepo.revokeAllSessions(target.id, new Date(), tx);
    await createAuditLog(
      {
        action: 'UPDATE',
        entity: 'UserPassword',
        entityId: target.id,
        userId: actor.id,
        organizationId: actor.organizationId,
        metadata: { reset: true },
      },
      tx,
    );
    return toOrgUserDto({ ...target, mustChangePassword: true });
  });
}
