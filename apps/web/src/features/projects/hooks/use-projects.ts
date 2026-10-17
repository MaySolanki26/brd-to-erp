import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { PagedResult, ProjectDto } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export const PROJECTS_PAGE_SIZE = 20;

export interface ProjectsFilter {
  page: number;
  search: string;
}

function toQueryString({ page, search }: ProjectsFilter): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(PROJECTS_PAGE_SIZE) });
  if (search) params.set('search', search);
  return params.toString();
}

export function useProjects(filter: ProjectsFilter) {
  return useQuery({
    queryKey: queryKeys.projects.list({ ...filter, pageSize: PROJECTS_PAGE_SIZE }),
    queryFn: () => apiClient.get<PagedResult<ProjectDto>>(`/projects?${toQueryString(filter)}`),
    placeholderData: keepPreviousData,
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: async () =>
      (await apiClient.get<{ project: ProjectDto }>(`/projects/${projectId}`)).project,
  });
}
