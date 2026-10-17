import { useInfiniteQuery } from '@tanstack/react-query';
import type { DecisionDto, PagedResult } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export const DECISIONS_PAGE_SIZE = 20;

export function useDecisions(projectId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.projects.decisions(projectId),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiClient.get<PagedResult<DecisionDto>>(
        `/projects/${projectId}/decisions?page=${String(pageParam)}&pageSize=${String(DECISIONS_PAGE_SIZE)}`,
      ),
    staleTime: STALE.standard,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
}
