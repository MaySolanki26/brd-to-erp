import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@brd/ui';
import type { LoginInput, UserDto } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { safeReturnTo } from '@/lib/return-to';

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  return useMutation({
    mutationFn: (data: LoginInput) => apiClient.post<{ user: UserDto }>('/auth/login', data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.me(), data.user);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate(safeReturnTo(params.get('returnTo')), { replace: true });
    },
  });
}
