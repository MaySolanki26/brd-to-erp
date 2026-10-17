import type { CreateProjectInput, ProjectDto } from '@brd/shared';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useCreateProject() {
  return useApiMutation({
    mutationFn: async (input: CreateProjectInput) =>
      (await apiClient.post<{ project: ProjectDto }>('/projects', input)).project,
    invalidate: [queryKeys.projects.all()],
    errorToast: false, // the create drawer shows the error inline
  });
}

export function useArchiveProject(projectId: string) {
  return useApiMutation({
    mutationFn: async () =>
      (await apiClient.post<{ project: ProjectDto }>(`/projects/${projectId}/archive`)).project,
    invalidate: [queryKeys.projects.all()],
    successMessage: 'Project archived',
  });
}
