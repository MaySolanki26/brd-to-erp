import type { CreateUserInput, OrgUserDto, ResetPasswordInput, UpdateUserInput } from '@brd/shared';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

const USER_KEYS = [queryKeys.users.all()];

// The create and reset drawers show their errors inline; role and status changes use a toast.
export function useCreateUser() {
  return useApiMutation({
    mutationFn: async (input: CreateUserInput) =>
      (await apiClient.post<{ user: OrgUserDto }>('/users', input)).user,
    invalidate: USER_KEYS,
    errorToast: false,
  });
}

export function useUpdateUser() {
  return useApiMutation({
    mutationFn: async ({ userId, ...input }: UpdateUserInput & { userId: string }) =>
      (await apiClient.patch<{ user: OrgUserDto }>(`/users/${userId}`, input)).user,
    invalidate: USER_KEYS,
  });
}

export function useResetUserPassword() {
  return useApiMutation({
    mutationFn: async ({ userId, ...input }: ResetPasswordInput & { userId: string }) =>
      (await apiClient.post<{ user: OrgUserDto }>(`/users/${userId}/reset-password`, input)).user,
    invalidate: USER_KEYS,
    errorToast: false,
  });
}
