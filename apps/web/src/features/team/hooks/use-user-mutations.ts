import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateUserInput, OrgUserDto, ResetPasswordInput, UpdateUserInput } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (input: CreateUserInput) =>
      (await apiClient.post<{ user: OrgUserDto }>('/users', input)).user,
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ userId, ...input }: UpdateUserInput & { userId: string }) =>
      (await apiClient.patch<{ user: OrgUserDto }>(`/users/${userId}`, input)).user,
    onSuccess: invalidate,
  });
}

export function useResetUserPassword() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ userId, ...input }: ResetPasswordInput & { userId: string }) =>
      (await apiClient.post<{ user: OrgUserDto }>(`/users/${userId}/reset-password`, input)).user,
    onSuccess: invalidate,
  });
}
