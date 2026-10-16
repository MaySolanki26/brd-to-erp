import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ConfirmUploadDto,
  ContextNoteDto,
  CreateNoteInput,
  DocumentDto,
  UpdateNoteInput,
  UploadUrlDto,
} from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { mimeTypeFor } from '../source-utils';

function useRefreshSources(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.documents(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.notes(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.processingStatus(projectId) }),
    ]);
}

interface UploadArgs {
  file: File;
  /** Set to upload a new version of an existing document. */
  documentId?: string;
}

/** Asks for a signed URL, sends the file to it, then confirms so processing can start. */
export function useUploadDocument(projectId: string) {
  const refresh = useRefreshSources(projectId);
  return useMutation({
    mutationFn: async ({ file, documentId }: UploadArgs): Promise<ConfirmUploadDto> => {
      const mimeType = mimeTypeFor(file.name) ?? file.type;
      const { upload } = await apiClient.post<{ upload: UploadUrlDto }>(
        `/projects/${projectId}/documents/upload-url`,
        { fileName: file.name, mimeType, sizeBytes: file.size, ...(documentId && { documentId }) },
      );
      await apiClient.upload(upload.uploadUrl, file, mimeType);
      return apiClient.post<ConfirmUploadDto>(`/projects/${projectId}/documents/confirm`, {
        ticket: upload.ticket,
      });
    },
    onSettled: refresh,
  });
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
