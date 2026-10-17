import type { ProjectRole, ProjectStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';

export interface MemberRecord {
  id: string;
  userId: string;
  role: ProjectRole;
  createdAt: Date;
  user: { name: string; email: string };
}

const memberSelect = {
  id: true,
  userId: true,
  role: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
} as const;

export async function listMembers(
  organizationId: string,
  projectId: string,
): Promise<MemberRecord[]> {
  return prisma.projectMember.findMany({
    where: { organizationId, projectId },
    select: memberSelect,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

export async function findMember(
  organizationId: string,
  projectId: string,
  userId: string,
  db: DbClient = prisma,
): Promise<MemberRecord | null> {
  return db.projectMember.findFirst({
    where: { organizationId, projectId, userId },
    select: memberSelect,
  });
}

export async function userExistsInOrg(organizationId: string, userId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId, deletedAt: null },
    select: { id: true },
  });
  return user !== null;
}

export interface MemberCandidateRecord {
  id: string;
  name: string;
  email: string;
}

/** Active users of the organization who are not yet members of the project. */
export async function listCandidates(
  organizationId: string,
  projectId: string,
): Promise<MemberCandidateRecord[]> {
  return prisma.user.findMany({
    where: {
      organizationId,
      deletedAt: null,
      projectMemberships: { none: { projectId } },
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
}

export async function addMember(
  data: { organizationId: string; projectId: string; userId: string; role: ProjectRole },
  db: DbClient,
): Promise<MemberRecord> {
  return db.projectMember.create({ data, select: memberSelect });
}

export async function updateMemberRole(
  memberId: string,
  role: ProjectRole,
  db: DbClient,
): Promise<MemberRecord> {
  return db.projectMember.update({ where: { id: memberId }, data: { role }, select: memberSelect });
}

export async function deleteMember(memberId: string, db: DbClient): Promise<void> {
  await db.projectMember.delete({ where: { id: memberId } });
}

export async function countOwners(
  organizationId: string,
  projectId: string,
  db: DbClient,
): Promise<number> {
  return db.projectMember.count({ where: { organizationId, projectId, role: 'OWNER' } });
}

/** Takes the project row lock so concurrent owner changes on one project run one at a time. */
export async function lockProject(
  organizationId: string,
  projectId: string,
  db: DbClient,
): Promise<ProjectStatus | null> {
  await db.project.updateMany({
    where: { id: projectId, organizationId },
    data: { updatedAt: new Date() },
  });
  const project = await db.project.findFirst({
    where: { id: projectId, organizationId },
    select: { status: true },
  });
  return project?.status ?? null;
}
