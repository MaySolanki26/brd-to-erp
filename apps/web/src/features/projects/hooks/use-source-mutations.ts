import { useQueryClient } from '@tanstack/react-query';
import type { ContextNoteDto, CreateNoteInput, DocumentDto, UpdateNoteInput } from '@brd/shared';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

function sourceKeys(projectId: string) {
  return [
    queryKeys.projects.documents(projectId),
    queryKeys.projects.notes(projectId),
    queryKeys.projects.processingStatus(projectId),
  ];
}

export function useRefreshSources(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      sourceKeys(projectId).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}

export function useReprocessDocument(projectId: string) {
  return useApiMutation({
    mutationFn: async (documentId: string) =>
      (
        await apiClient.post<{ document: DocumentDto }>(
          `/projects/${projectId}/documents/${documentId}/reprocess`,
        )
      ).document,
    invalidate: sourceKeys(projectId),
    invalidateOn: 'settled',
  });
}

// The note drawer shows note errors inline.
export function useCreateNote(projectId: string) {
  return useApiMutation({
    mutationFn: async (input: CreateNoteInput) =>
      (await apiClient.post<{ note: ContextNoteDto }>(`/projects/${projectId}/notes`, input)).note,
    invalidate: sourceKeys(projectId),
    invalidateOn: 'settled',
    errorToast: false,
  });
}

export function useUpdateNote(projectId: string) {
  return useApiMutation({
    mutationFn: async ({ noteId, ...input }: UpdateNoteInput & { noteId: string }) =>
      (
        await apiClient.patch<{ note: ContextNoteDto }>(
          `/projects/${projectId}/notes/${noteId}`,
          input,
        )
      ).note,
    invalidate: sourceKeys(projectId),
    invalidateOn: 'settled',
    errorToast: false,
  });
}
