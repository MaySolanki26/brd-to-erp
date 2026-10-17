import { useQuery } from '@tanstack/react-query';
import type { ChunkDetailDto } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useChunk(projectId: string, chunkId: string | null) {
  return useQuery({
    queryKey: queryKeys.projects.chunk(projectId, chunkId ?? ''),
    queryFn: async () =>
      (
        await apiClient.get<{ chunk: ChunkDetailDto }>(
          `/projects/${projectId}/chunks/${chunkId ?? ''}`,
        )
      ).chunk,
    enabled: chunkId !== null,
  });
}
