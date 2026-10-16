import type { ProjectRole, ProjectStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';
import { projectSelect, type ProjectRecord } from '../access/access.repository.js';

export interface ProjectWithRole extends ProjectRecord {
  myRole: ProjectRole | null;
}

export interface ListProjectsParams {
  organizationId: string;
  userId: string;
  allInOrg: boolean;
  includeArchived: boolean;
  page: number;
  pageSize: number;
}

export async function listProjects(
  params: ListProjectsParams,
): Promise<{ items: ProjectWithRole[]; total: number }> {
  const where = {
    organizationId: params.organizationId,
    ...(params.allInOrg ? {} : { members: { some: { userId: params.userId } } }),
    ...(params.includeArchived ? {} : { status: { not: 'ARCHIVED' as const } }),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      select: {
        ...projectSelect,
        members: { where: { userId: params.userId }, select: { role: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ]);

  const items = rows.map(({ members, ...project }) => ({
    ...project,
    myRole: members[0]?.role ?? null,
  }));
  return { items, total };
}

export async function createProject(
  data: { name: string; description?: string | undefined; organizationId: string },
  db: DbClient,
): Promise<ProjectRecord> {
  return db.project.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      organizationId: data.organizationId,
      status: 'ACTIVE',
    },
    select: projectSelect,
  });
}

export async function addOwner(
  data: { projectId: string; userId: string; organizationId: string },
  db: DbClient,
): Promise<void> {
  await db.projectMember.create({
    data: { ...data, role: 'OWNER' },
  });
}

export async function updateProject(
  organizationId: string,
  projectId: string,
  data: {
    name?: string | undefined;
    description?: string | null | undefined;
    status?: ProjectStatus | undefined;
  },
  db: DbClient,
): Promise<ProjectRecord | null> {
  const result = await db.project.updateMany({
    where: { id: projectId, organizationId },
    data,
  });
  if (result.count === 0) return null;
  return db.project.findFirst({ where: { id: projectId, organizationId }, select: projectSelect });
}
