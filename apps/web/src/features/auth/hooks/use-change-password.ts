import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from '@brd/ui';
import type { ChangePasswordInput, UserDto } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useChangePassword() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: ChangePasswordInput) =>
      apiClient.post<{ user: UserDto }>('/auth/change-password', data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.me(), data.user);
      toast.success('Password updated');
      navigate('/', { replace: true });
    },
  });
}
