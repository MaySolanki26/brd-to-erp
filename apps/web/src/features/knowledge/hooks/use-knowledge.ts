import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  BusinessRuleDto,
  KnowledgeKind,
  KnowledgeSummaryDto,
  ModuleDto,
  PagedResult,
  RequirementDto,
} from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { KnowledgeFilters } from './use-knowledge-filters';

export const KNOWLEDGE_PAGE_SIZE = 20;
const OPTIONS_PAGE_SIZE = 100;

function queryString(filters: KnowledgeFilters, kind: KnowledgeKind): string {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(KNOWLEDGE_PAGE_SIZE),
  });
  if (filters.status) params.set('status', filters.status);
  if (filters.moduleId && kind !== 'modules') params.set('moduleId', filters.moduleId);
  if (filters.sourceId) params.set('sourceId', filters.sourceId);
  if (filters.search) params.set('search', filters.search);
  return params.toString();
}

function useKnowledgeList<T>(projectId: string, kind: KnowledgeKind, filters: KnowledgeFilters) {
  return useQuery({
    queryKey: queryKeys.projects.knowledge(projectId, kind, { ...filters }),
    queryFn: () =>
      apiClient.get<PagedResult<T>>(`/projects/${projectId}/${kind}?${queryString(filters, kind)}`),
    placeholderData: keepPreviousData,
  });
}

export const useRequirements = (projectId: string, filters: KnowledgeFilters) =>
  useKnowledgeList<RequirementDto>(projectId, 'requirements', filters);

export const useRules = (projectId: string, filters: KnowledgeFilters) =>
  useKnowledgeList<BusinessRuleDto>(projectId, 'rules', filters);

export const useModules = (projectId: string, filters: KnowledgeFilters) =>
  useKnowledgeList<ModuleDto>(projectId, 'modules', filters);

/** Every module in the project, for the module filter. */
export function useModuleOptions(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.knowledge(projectId, 'modules', { options: true }),
    queryFn: async () =>
      (
        await apiClient.get<PagedResult<ModuleDto>>(
          `/projects/${projectId}/modules?pageSize=${String(OPTIONS_PAGE_SIZE)}`,
        )
      ).items.map((m) => ({ id: m.id, name: m.name })),
  });
}

export function useKnowledgeSummary(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.knowledgeSummary(projectId),
    queryFn: async () =>
      (
        await apiClient.get<{ summary: KnowledgeSummaryDto }>(
          `/projects/${projectId}/knowledge-summary`,
        )
      ).summary,
  });
}
