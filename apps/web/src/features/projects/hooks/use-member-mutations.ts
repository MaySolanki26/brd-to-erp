import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AddMemberInput, MemberDto, ProjectRole } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

function useRefreshMembers(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.members(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.candidates(projectId) }),
    ]);
}

export function useAddMember(projectId: string) {
  const refresh = useRefreshMembers(projectId);
  return useMutation({
    mutationFn: async (input: AddMemberInput) =>
      (await apiClient.post<{ member: MemberDto }>(`/projects/${projectId}/members`, input)).member,
    onSuccess: refresh,
  });
}

export function useUpdateMemberRole(projectId: string) {
  const refresh = useRefreshMembers(projectId);
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: ProjectRole }) =>
      (
        await apiClient.patch<{ member: MemberDto }>(`/projects/${projectId}/members/${userId}`, {
          role,
        })
      ).member,
    onSuccess: refresh,
  });
}

export function useRemoveMember(projectId: string) {
  const refresh = useRefreshMembers(projectId);
  return useMutation({
    mutationFn: (userId: string) => apiClient.del<void>(`/projects/${projectId}/members/${userId}`),
    onSuccess: refresh,
  });
}
