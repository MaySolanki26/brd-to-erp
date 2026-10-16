import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ContextNoteDto,
  DocumentDetailDto,
  DocumentDto,
  PagedResult,
  ProcessingStatusDto,
} from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

const PAGE_SIZE = 100;
const POLL_MS = 3000;
export const CHUNK_PAGE_SIZE = 20;

export function useDocuments(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.documents(projectId),
    queryFn: () =>
      apiClient.get<PagedResult<DocumentDto>>(
        `/projects/${projectId}/documents?pageSize=${String(PAGE_SIZE)}`,
      ),
  });
}

export function useNotes(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.notes(projectId),
    queryFn: () =>
      apiClient.get<PagedResult<ContextNoteDto>>(
        `/projects/${projectId}/notes?pageSize=${String(PAGE_SIZE)}`,
      ),
  });
}

export function useDocumentDetail(
  projectId: string,
  documentId: string | null,
  versionId: string | null,
  page: number,
) {
  return useQuery({
    queryKey: queryKeys.projects.document(projectId, documentId ?? '', versionId, page),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(CHUNK_PAGE_SIZE) });
      if (versionId) params.set('versionId', versionId);
      return (
        await apiClient.get<{ document: DocumentDetailDto }>(
          `/projects/${projectId}/documents/${documentId ?? ''}?${params.toString()}`,
        )
      ).document;
    },
    enabled: documentId !== null,
  });
}

/**
 * Polls the processing status only while something is queued or running, and refreshes the
 * document and note lists whenever the status counts change.
 */
export function useProcessingStatus(projectId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.projects.processingStatus(projectId),
    queryFn: async () =>
      (
        await apiClient.get<{ status: ProcessingStatusDto }>(
          `/projects/${projectId}/processing-status`,
        )
      ).status,
    refetchInterval: (q) => (q.state.data?.active ? POLL_MS : false),
  });

  const countsKey = query.data ? JSON.stringify(query.data.counts) : null;
  useEffect(() => {
    if (countsKey === null) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects.documents(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects.notes(projectId) });
  }, [countsKey, projectId, queryClient]);

  return query;
}
