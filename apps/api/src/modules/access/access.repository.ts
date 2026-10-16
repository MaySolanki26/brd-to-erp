import type { ProjectRole, ProjectStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const projectSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function findProjectInOrg(
  organizationId: string,
  projectId: string,
): Promise<ProjectRecord | null> {
  return prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: projectSelect,
  });
}

export async function findMembershipRole(
  organizationId: string,
  projectId: string,
  userId: string,
): Promise<ProjectRole | null> {
  const member = await prisma.projectMember.findFirst({
    where: { organizationId, projectId, userId },
    select: { role: true },
  });
  return member?.role ?? null;
}
