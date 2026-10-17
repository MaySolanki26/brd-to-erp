# React Query Hook Templates

## features/projects/api/project.keys.ts

```ts
import type { ListProjectsQuery } from '@brd/shared';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params: ListProjectsQuery) => [...projectKeys.lists(), params] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
};
```

## features/projects/api/project.queries.ts

```ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProjectSchema,
  projectListResponseSchema,
  projectResponseSchema,
  type CreateProjectInput,
  type ListProjectsQuery,
} from '@brd/shared';
import { api } from '@/lib/api-client';
import { toast } from '@brd/ui';
import { projectKeys } from './project.keys';

export function useProjectsQuery(params: ListProjectsQuery) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => api.get('/projects', { params, schema: projectListResponseSchema }),
    staleTime: 30_000,
    placeholderData: keepPreviousData, // no flicker while paging
  });
}

export function useProjectQuery(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => api.get(`/projects/${id}`, { schema: projectResponseSchema }),
    staleTime: 30_000,
  });
}

export function useCreateProjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      api.post('/projects', createProjectSchema.parse(input), { schema: projectResponseSchema }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
      qc.setQueryData(projectKeys.detail(project.id), project);
      toast.success('Project created');
    },
    // errors: api client maps to standard error format; the form shows field errors
  });
}
```

## Polling while processing

```ts
useQuery({
  queryKey: ['projects', projectId, 'processing-status'],
  queryFn: () => api.get(`/projects/${projectId}/processing-status`, { schema: statusSchema }),
  refetchInterval: (query) => (query.state.data?.status === 'PROCESSING' ? 3000 : false),
});
```
