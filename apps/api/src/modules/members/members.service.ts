import type {
  AddMemberInput,
  MemberCandidateDto,
  MemberDto,
  ProjectRole,
  UpdateMemberInput,
  UserDto,
} from '@brd/shared';
import { ConflictError, NotFoundError } from '../../errors/app-error.js';
import { withTransaction, type DbClient } from '../../lib/transaction.js';
import { createAuditLog } from '../audit/audit.repository.js';
import * as repo from './members.repository.js';

function toMemberDto(member: repo.MemberRecord): MemberDto {
  return {
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
  };
}

const ARCHIVED = 'Archived projects cannot be modified';

/** Locks the project and refuses writes to archived ones; the lock also serializes member changes. */
async function lockActiveProject(user: UserDto, projectId: string, tx: DbClient): Promise<void> {
  const status = await repo.lockProject(user.organizationId, projectId, tx);
  if (status === null) {
    throw new NotFoundError('Project not found');
  }
  if (status === 'ARCHIVED') {
    throw new ConflictError(ARCHIVED);
  }
}

async function assertNotLastOwner(
  user: UserDto,
  projectId: string,
  member: repo.MemberRecord,
  tx: DbClient,
): Promise<void> {
  if (member.role !== 'OWNER') return;
  const owners = await repo.countOwners(user.organizationId, projectId, tx);
  if (owners <= 1) {
    throw new ConflictError('A project must keep at least one owner');
  }
}

export async function listMembers(user: UserDto, projectId: string): Promise<MemberDto[]> {
  const members = await repo.listMembers(user.organizationId, projectId);
  return members.map(toMemberDto);
}

export async function listCandidates(
  user: UserDto,
  projectId: string,
): Promise<MemberCandidateDto[]> {
  const candidates = await repo.listCandidates(user.organizationId, projectId);
  return candidates.map(({ id, name, email }) => ({ userId: id, name, email }));
}

export async function addMember(
  user: UserDto,
  projectId: string,
  input: AddMemberInput,
): Promise<MemberDto> {
  if (!(await repo.userExistsInOrg(user.organizationId, input.userId))) {
    throw new NotFoundError('User not found');
  }

  return withTransaction(async (tx) => {
    await lockActiveProject(user, projectId, tx);
    if (await repo.findMember(user.organizationId, projectId, input.userId, tx)) {
      throw new ConflictError('User is already a member of this project');
    }
    const member = await repo.addMember(
      { organizationId: user.organizationId, projectId, userId: input.userId, role: input.role },
      tx,
    );
    await createAuditLog(
      {
        action: 'CREATE',
        entity: 'ProjectMember',
        entityId: member.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { projectId, memberUserId: input.userId, role: input.role },
      },
      tx,
    );
    return toMemberDto(member);
  });
}

export async function updateMemberRole(
  user: UserDto,
  projectId: string,
  targetUserId: string,
  input: UpdateMemberInput,
): Promise<MemberDto> {
  return withTransaction(async (tx) => {
    await lockActiveProject(user, projectId, tx);
    const member = await repo.findMember(user.organizationId, projectId, targetUserId, tx);
    if (!member) {
      throw new NotFoundError('Member not found');
    }
    if (input.role !== 'OWNER') {
      await assertNotLastOwner(user, projectId, member, tx);
    }
    const previousRole: ProjectRole = member.role;
    const updated = await repo.updateMemberRole(member.id, input.role, tx);
    await createAuditLog(
      {
        action: 'UPDATE',
        entity: 'ProjectMember',
        entityId: member.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { projectId, memberUserId: targetUserId, previousRole, role: input.role },
      },
      tx,
    );
    return toMemberDto(updated);
  });
}

export async function removeMember(
  user: UserDto,
  projectId: string,
  targetUserId: string,
): Promise<void> {
  await withTransaction(async (tx) => {
    await repo.lockProject(user.organizationId, projectId, tx);
    const member = await repo.findMember(user.organizationId, projectId, targetUserId, tx);
    if (!member) {
      throw new NotFoundError('Member not found');
    }
    await assertNotLastOwner(user, projectId, member, tx);
    await repo.deleteMember(member.id, tx);
    await createAuditLog(
      {
        action: 'DELETE',
        entity: 'ProjectMember',
        entityId: member.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { projectId, memberUserId: targetUserId, role: member.role },
      },
      tx,
    );
  });
}
