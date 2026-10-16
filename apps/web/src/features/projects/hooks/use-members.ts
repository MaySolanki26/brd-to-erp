import { useQuery } from '@tanstack/react-query';
import type { MemberCandidateDto, MemberDto } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useMembers(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.projects.members(projectId),
    queryFn: async () =>
      (await apiClient.get<{ members: MemberDto[] }>(`/projects/${projectId}/members`)).members,
    enabled,
  });
}

export function useMemberCandidates(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.projects.candidates(projectId),
    queryFn: async () =>
      (
        await apiClient.get<{ candidates: MemberCandidateDto[] }>(
          `/projects/${projectId}/members/candidates`,
        )
      ).candidates,
    enabled,
  });
}
