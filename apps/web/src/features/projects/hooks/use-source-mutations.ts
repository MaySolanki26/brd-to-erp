import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ContextNoteDto, CreateNoteInput, DocumentDto, UpdateNoteInput } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useRefreshSources(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.documents(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.notes(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.processingStatus(projectId) }),
    ]);
}

export function useReprocessDocument(projectId: string) {
  const refresh = useRefreshSources(projectId);
  return useMutation({
    mutationFn: async (documentId: string) =>
      (
        await apiClient.post<{ document: DocumentDto }>(
          `/projects/${projectId}/documents/${documentId}/reprocess`,
        )
      ).document,
    onSettled: refresh,
  });
}

export function useCreateNote(projectId: string) {
  const refresh = useRefreshSources(projectId);
  return useMutation({
    mutationFn: async (input: CreateNoteInput) =>
      (await apiClient.post<{ note: ContextNoteDto }>(`/projects/${projectId}/notes`, input)).note,
    onSettled: refresh,
  });
}

export function useUpdateNote(projectId: string) {
  const refresh = useRefreshSources(projectId);
  return useMutation({
    mutationFn: async ({ noteId, ...input }: UpdateNoteInput & { noteId: string }) =>
      (
        await apiClient.patch<{ note: ContextNoteDto }>(
          `/projects/${projectId}/notes/${noteId}`,
          input,
        )
      ).note,
    onSettled: refresh,
  });
}
