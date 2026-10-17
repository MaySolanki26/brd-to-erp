import type {
  BusinessRuleDto,
  ChunkDetailDto,
  KnowledgeKind,
  KnowledgeSourceDto,
  KnowledgeStatus,
  KnowledgeSummaryDto,
  ListKnowledgeQuery,
  ListModulesQuery,
  ModuleDto,
  PagedResult,
  RequirementDto,
  UserDto,
} from '@brd/shared';
import { KNOWLEDGE_STATUSES } from '@brd/shared';
import { NotFoundError } from '../../errors/app-error.js';
import * as repo from './knowledge.repository.js';

function toSource(chunk: repo.ChunkRecord): KnowledgeSourceDto {
  const base = {
    chunkId: chunk.id,
    headingPath: chunk.headingPath,
    needsReview: chunk.needsReview,
  };
  if (chunk.documentVersion) {
    return {
      ...base,
      type: 'document',
      sourceId: chunk.documentVersion.document.id,
      sourceTitle: chunk.documentVersion.document.title,
      versionNumber: chunk.documentVersion.versionNumber,
    };
  }
  return {
    ...base,
    type: 'note',
    sourceId: chunk.contextNote?.id ?? '',
    sourceTitle: chunk.contextNote?.title ?? '',
    versionNumber: null,
  };
}

function toCreator(
  createdBy: { id: string; name: string } | null,
): 'AI' | { id: string; name: string } {
  return createdBy ?? 'AI';
}

function paged<T>(items: T[], total: number, page: number, pageSize: number): PagedResult<T> {
  return { items, page, pageSize, total };
}

export async function listRequirements(
  user: UserDto,
  projectId: string,
  query: ListKnowledgeQuery,
): Promise<PagedResult<RequirementDto>> {
  const { items, total } = await repo.listRequirements({
    ...query,
    organizationId: user.organizationId,
    projectId,
  });
  return paged(
    items.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      module: r.module,
      createdBy: toCreator(r.createdBy),
      source: toSource(r.sourceChunk),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total,
    query.page,
    query.pageSize,
  );
}

export async function listRules(
  user: UserDto,
  projectId: string,
  query: ListKnowledgeQuery,
): Promise<PagedResult<BusinessRuleDto>> {
  const { items, total } = await repo.listRules({
    ...query,
    organizationId: user.organizationId,
    projectId,
  });
  return paged(
    items.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      module: r.module,
      createdBy: toCreator(r.createdBy),
      source: toSource(r.sourceChunk),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total,
    query.page,
    query.pageSize,
  );
}

export async function listModules(
  user: UserDto,
  projectId: string,
  query: ListModulesQuery,
): Promise<PagedResult<ModuleDto>> {
  const { items, total } = await repo.listModules({
    ...query,
    organizationId: user.organizationId,
    projectId,
  });
  return paged(
    items.map((m) => ({
      id: m.id,
      name: m.name,
      code: m.code,
      description: m.description,
      status: m.status,
      requirementCount: m._count.requirements,
      createdBy: toCreator(m.createdBy),
      source: toSource(m.sourceChunk),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    total,
    query.page,
    query.pageSize,
  );
}

function fillStatuses(rows: repo.StatusCount[]): Record<KnowledgeStatus, number> {
  const counts = Object.fromEntries(KNOWLEDGE_STATUSES.map((s) => [s, 0])) as Record<
    KnowledgeStatus,
    number
  >;
  for (const { status, count } of rows) {
    counts[status] += count;
  }
  return counts;
}

export async function getSummary(user: UserDto, projectId: string): Promise<KnowledgeSummaryDto> {
  const org = user.organizationId;
  const [requirements, rules, modules, chunksNeedingReview] = await Promise.all([
    repo.countRequirementsByStatus(org, projectId),
    repo.countRulesByStatus(org, projectId),
    repo.countModulesByStatus(org, projectId),
    repo.countChunksNeedingReview(org, projectId),
  ]);
  const counts: Record<KnowledgeKind, Record<KnowledgeStatus, number>> = {
    requirements: fillStatuses(requirements),
    rules: fillStatuses(rules),
    modules: fillStatuses(modules),
  };
  return { counts, chunksNeedingReview };
}

export async function getChunk(
  user: UserDto,
  projectId: string,
  chunkId: string,
): Promise<ChunkDetailDto> {
  const chunk = await repo.findChunk(user.organizationId, projectId, chunkId);
  if (!chunk) {
    throw new NotFoundError('Chunk not found');
  }
  const { type, sourceId, sourceTitle, versionNumber } = toSource(chunk);
  return {
    id: chunk.id,
    chunkIndex: chunk.chunkIndex,
    headingPath: chunk.headingPath,
    content: chunk.content,
    needsReview: chunk.needsReview,
    source: { type, sourceId, sourceTitle, versionNumber },
  };
}
