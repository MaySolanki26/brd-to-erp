import { useQuery } from '@tanstack/react-query';
import type { OrgUserDto } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: async () => (await apiClient.get<{ users: OrgUserDto[] }>('/users')).users,
  });
}
