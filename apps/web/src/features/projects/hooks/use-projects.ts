import { useQuery } from '@tanstack/react-query';
import type { PagedResult, ProjectDto } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

const PAGE_SIZE = 50;

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.list({ pageSize: PAGE_SIZE }),
    queryFn: () => apiClient.get<PagedResult<ProjectDto>>(`/projects?pageSize=${PAGE_SIZE}`),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: async () =>
      (await apiClient.get<{ project: ProjectDto }>(`/projects/${projectId}`)).project,
  });
}
