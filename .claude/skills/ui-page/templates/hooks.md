# Query keys and hooks

> Every file below was compiled, linted and tested in a scratch copy of this repository (2026-10-17). Copy it, then rename. Paths are relative to the repository root.

### Query key factory (prefix key and page key)

```ts
// apps/web/src/lib/query-keys.ts — inside `projects: { ... }`
milestones: (id: string, page?: number) =>
  page === undefined
    ? (['projects', 'detail', id, 'milestones'] as const)
    : (['projects', 'detail', id, 'milestones', page] as const),
```

### `apps/web/src/features/milestones/hooks/use-milestones.ts`

```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { CreateMilestoneInput, MilestoneDto, PagedResult } from '@brd/shared';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiClient } from '@/lib/api-client';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export const MILESTONES_PAGE_SIZE = 20;

export function useMilestones(projectId: string, page: number) {
  return useQuery({
    queryKey: queryKeys.projects.milestones(projectId, page),
    queryFn: () =>
      apiClient.get<PagedResult<MilestoneDto>>(
        `/projects/${projectId}/milestones?page=${String(page)}&pageSize=${String(MILESTONES_PAGE_SIZE)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: STALE.standard,
  });
}

// The drawer shows a failed save inline, so no error toast.
export function useCreateMilestone(projectId: string) {
  return useApiMutation({
    mutationFn: async (input: CreateMilestoneInput) =>
      (await apiClient.post<{ milestone: MilestoneDto }>(`/projects/${projectId}/milestones`, input))
        .milestone,
    invalidate: [queryKeys.projects.milestones(projectId)],
    successMessage: 'Milestone added',
    errorToast: false,
  });
}
```

### `apps/web/src/features/projects/hooks/use-update-project.ts`

```ts
import type { ProjectDto, UpdateProjectInput } from '@brd/shared';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

// The settings page shows a failed save inline, so no error toast.
export function useUpdateProject(projectId: string) {
  return useApiMutation({
    mutationFn: async (input: UpdateProjectInput) =>
      (await apiClient.patch<{ project: ProjectDto }>(`/projects/${projectId}`, input)).project,
    invalidate: [queryKeys.projects.all()],
    successMessage: 'Project settings saved',
    errorToast: false,
  });
}
```

### Filters, search and page in the URL

```ts
import { z } from 'zod';
import { useUrlState } from '@/hooks/use-url-state';

// Every field has a default, so an invalid or missing value never breaks the page.
const URL_STATE = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  search: z.string().max(200).catch(''),
});

const [{ page, search }, setUrlState] = useUrlState(URL_STATE);
setUrlState({ search: 'acme', page: 1 }); // writes ?search=acme and drops page=1 (the default)
```

## Notes

- `useApiMutation` toasts failures by default. Both mutations above pass `errorToast: false` because their form shows the error under the fields.
- A paged tab uses its own URL key (`milestonesPage`) so it does not clash with the other tabs' state in the same address.
- Staleness comes from `STALE.standard` (30 s), `STALE.reference` (10 min) or `STALE.live` (0, with polling).
