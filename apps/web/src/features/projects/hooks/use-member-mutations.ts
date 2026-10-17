import type { AddMemberInput, MemberDto, ProjectRole } from '@brd/shared';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

// Callers show member errors inline, next to the form or list.
function memberKeys(projectId: string) {
  return [queryKeys.projects.members(projectId), queryKeys.projects.candidates(projectId)];
}

export function useAddMember(projectId: string) {
  return useApiMutation({
    mutationFn: async (input: AddMemberInput) =>
      (await apiClient.post<{ member: MemberDto }>(`/projects/${projectId}/members`, input)).member,
    invalidate: memberKeys(projectId),
    errorToast: false,
  });
}

export function useUpdateMemberRole(projectId: string) {
  return useApiMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: ProjectRole }) =>
      (
        await apiClient.patch<{ member: MemberDto }>(`/projects/${projectId}/members/${userId}`, {
          role,
        })
      ).member,
    invalidate: memberKeys(projectId),
    errorToast: false,
  });
}

export function useRemoveMember(projectId: string) {
  return useApiMutation({
    mutationFn: (userId: string) => apiClient.del<void>(`/projects/${projectId}/members/${userId}`),
    invalidate: memberKeys(projectId),
    errorToast: false,
  });
}
