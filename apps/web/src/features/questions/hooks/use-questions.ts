import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { PagedResult, QuestionCountsDto, QuestionDto } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import type { QuestionFilters } from './use-question-filters';

export const QUESTIONS_PAGE_SIZE = 50;
const LIST_STALE_MS = STALE.standard;

function queryString(filters: QuestionFilters, page: number): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(QUESTIONS_PAGE_SIZE) });
  if (filters.status) params.set('status', filters.status);
  if (filters.reason) params.set('reason', filters.reason);
  if (filters.priority) params.set('priority', filters.priority);
  return params.toString();
}

/** The server sorts by urgency, so the first pages hold the questions that matter most. */
export function useQuestions(projectId: string, filters: QuestionFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.projects.questions(projectId, { ...filters }),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiClient.get<PagedResult<QuestionDto>>(
        `/projects/${projectId}/questions?${queryString(filters, pageParam)}`,
      ),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    placeholderData: keepPreviousData,
    staleTime: LIST_STALE_MS,
  });
}

export function useQuestionCounts(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.questionCounts(projectId),
    queryFn: async () =>
      (
        await apiClient.get<{ counts: QuestionCountsDto }>(
          `/projects/${projectId}/questions/counts`,
        )
      ).counts,
    staleTime: LIST_STALE_MS,
  });
}
