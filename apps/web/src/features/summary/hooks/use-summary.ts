import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SummaryResponseDto } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

/** `version` null means the latest one. `pollMs` keeps checking for a newer summary. */
export function useSummary(
  projectId: string,
  version: number | null,
  pollMs: number | false = false,
) {
  return useQuery({
    queryKey: queryKeys.projects.summary(projectId, version),
    queryFn: () =>
      apiClient.get<SummaryResponseDto>(
        `/projects/${projectId}/summary${version === null ? '' : `?version=${String(version)}`}`,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: pollMs,
    staleTime: 30_000,
  });
}

/** Asks for a new summary. It is built in the background, so this only confirms the request. */
export function useRequestSummary(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<{ requested: boolean }>(`/projects/${projectId}/summary/refresh`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.summaryAll(projectId) }),
  });
}
