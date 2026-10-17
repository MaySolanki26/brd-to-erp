import type { KnowledgeStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const chunkSelect = {
  id: true,
  headingPath: true,
  needsReview: true,
  documentVersion: {
    select: { versionNumber: true, document: { select: { id: true, title: true } } },
  },
  contextNote: { select: { id: true, title: true } },
} satisfies Prisma.ChunkSelect;

const creatorSelect = { select: { id: true, name: true } } as const;

export type ChunkRecord = Prisma.ChunkGetPayload<{ select: typeof chunkSelect }>;

export interface ListParams {
  organizationId: string;
  projectId: string;
  page: number;
  pageSize: number;
  status?: KnowledgeStatus | undefined;
  moduleId?: string | undefined;
  sourceId?: string | undefined;
  search?: string | undefined;
}

const requirementSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  module: { select: { id: true, name: true } },
  createdBy: creatorSelect,
  sourceChunk: { select: chunkSelect },
} satisfies Prisma.RequirementSelect;

const ruleSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  module: { select: { id: true, name: true } },
  createdBy: creatorSelect,
  sourceChunk: { select: chunkSelect },
} satisfies Prisma.BusinessRuleSelect;

const moduleSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: creatorSelect,
  sourceChunk: { select: chunkSelect },
  _count: { select: { requirements: { where: { deletedAt: null } } } },
} satisfies Prisma.ModuleSelect;

export type RequirementRecord = Prisma.RequirementGetPayload<{ select: typeof requirementSelect }>;
export type BusinessRuleRecord = Prisma.BusinessRuleGetPayload<{ select: typeof ruleSelect }>;
export type ModuleRecord = Prisma.ModuleGetPayload<{ select: typeof moduleSelect }>;

/** Items extracted from any version of a document, or from a note, match that source. */
function fromSource(sourceId: string): Prisma.ChunkWhereInput {
  return { OR: [{ documentVersion: { documentId: sourceId } }, { contextNoteId: sourceId }] };
}

function contains(search: string) {
  return { contains: search, mode: 'insensitive' as const };
}

const NEWEST_FIRST = [{ createdAt: 'desc' }, { id: 'asc' }] as const;

export async function listRequirements(
  p: ListParams,
): Promise<{ items: RequirementRecord[]; total: number }> {
  const where: Prisma.RequirementWhereInput = {
    organizationId: p.organizationId,
    projectId: p.projectId,
    deletedAt: null,
    ...(p.status && { status: p.status }),
    ...(p.moduleId && { moduleId: p.moduleId }),
    ...(p.sourceId && { sourceChunk: fromSource(p.sourceId) }),
    ...(p.search && { OR: [{ title: contains(p.search) }, { description: contains(p.search) }] }),
  };
  const [total, items] = await prisma.$transaction([
    prisma.requirement.count({ where }),
    prisma.requirement.findMany({
      where,
      select: requirementSelect,
      orderBy: [...NEWEST_FIRST],
      skip: (p.page - 1) * p.pageSize,
      take: p.pageSize,
    }),
  ]);
  return { items, total };
}

export async function listRules(
  p: ListParams,
): Promise<{ items: BusinessRuleRecord[]; total: number }> {
  const where: Prisma.BusinessRuleWhereInput = {
    organizationId: p.organizationId,
    projectId: p.projectId,
    ...(p.status && { status: p.status }),
    ...(p.moduleId && { moduleId: p.moduleId }),
    ...(p.sourceId && { sourceChunk: fromSource(p.sourceId) }),
    ...(p.search && { OR: [{ title: contains(p.search) }, { description: contains(p.search) }] }),
  };
  const [total, items] = await prisma.$transaction([
    prisma.businessRule.count({ where }),
    prisma.businessRule.findMany({
      where,
      select: ruleSelect,
      orderBy: [...NEWEST_FIRST],
      skip: (p.page - 1) * p.pageSize,
      take: p.pageSize,
    }),
  ]);
  return { items, total };
}

export async function listModules(
  p: Omit<ListParams, 'moduleId'>,
): Promise<{ items: ModuleRecord[]; total: number }> {
  const where: Prisma.ModuleWhereInput = {
    organizationId: p.organizationId,
    projectId: p.projectId,
    ...(p.status && { status: p.status }),
    ...(p.sourceId && { sourceChunk: fromSource(p.sourceId) }),
    ...(p.search && {
      OR: [
        { name: contains(p.search) },
        { code: contains(p.search) },
        { description: contains(p.search) },
      ],
    }),
  };
  const [total, items] = await prisma.$transaction([
    prisma.module.count({ where }),
    prisma.module.findMany({
      where,
      select: moduleSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (p.page - 1) * p.pageSize,
      take: p.pageSize,
    }),
  ]);
  return { items, total };
}

export interface StatusCount {
  status: KnowledgeStatus;
  count: number;
}

export async function countRequirementsByStatus(
  organizationId: string,
  projectId: string,
): Promise<StatusCount[]> {
  const groups = await prisma.requirement.groupBy({
    by: ['status'],
    where: { organizationId, projectId, deletedAt: null },
    _count: { _all: true },
  });
  return groups.map((g) => ({ status: g.status, count: g._count._all }));
}

export async function countRulesByStatus(
  organizationId: string,
  projectId: string,
): Promise<StatusCount[]> {
  const groups = await prisma.businessRule.groupBy({
    by: ['status'],
    where: { organizationId, projectId },
    _count: { _all: true },
  });
  return groups.map((g) => ({ status: g.status, count: g._count._all }));
}

export async function countModulesByStatus(
  organizationId: string,
  projectId: string,
): Promise<StatusCount[]> {
  const groups = await prisma.module.groupBy({
    by: ['status'],
    where: { organizationId, projectId },
    _count: { _all: true },
  });
  return groups.map((g) => ({ status: g.status, count: g._count._all }));
}

export async function countChunksNeedingReview(
  organizationId: string,
  projectId: string,
): Promise<number> {
  return prisma.chunk.count({ where: { organizationId, projectId, needsReview: true } });
}

export interface ChunkWithContent extends ChunkRecord {
  chunkIndex: number;
  content: string;
}

export async function findChunk(
  organizationId: string,
  projectId: string,
  chunkId: string,
): Promise<ChunkWithContent | null> {
  return prisma.chunk.findFirst({
    where: { id: chunkId, organizationId, projectId },
    select: { ...chunkSelect, chunkIndex: true, content: true },
  });
}
