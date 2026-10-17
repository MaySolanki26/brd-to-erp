import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConfirmUploadDto, UploadUrlDto } from '@brd/shared';
import { apiClient, UploadCanceledError } from '@/lib/api-client';
import { errorMessage } from '@/lib/error-message';
import { checkUploadable, mimeTypeFor } from '../source-utils';
import { useRefreshSources } from './use-source-mutations';

export type UploadStatus =
  'queued' | 'uploading' | 'confirming' | 'done' | 'failed' | 'canceled' | 'rejected';

export interface UploadItem {
  id: string;
  fileName: string;
  size: number;
  status: UploadStatus;
  /** 0-100 while the file is being sent. */
  progress: number;
  error: string | null;
  duplicateOf: { documentId: string; title: string } | null;
  /** Set when this upload is a new version of an existing document. */
  documentId: string | null;
  documentName: string | null;
}

export interface AddFilesOptions {
  documentId?: string;
  documentName?: string;
}

export const MAX_PARALLEL_UPLOADS = 2;

const FINISHED: readonly UploadStatus[] = ['done', 'failed', 'canceled', 'rejected'];
const CLEARABLE: readonly UploadStatus[] = ['done', 'canceled', 'rejected'];
const ACTIVE: readonly UploadStatus[] = ['queued', 'uploading', 'confirming'];

export function isFinished(status: UploadStatus): boolean {
  return FINISHED.includes(status);
}

function sameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

/**
 * Uploads files two at a time through the signed-URL flow (request URL, send bytes, confirm),
 * reporting progress and allowing cancel and retry. The queue only lives in this component.
 */
export function useUploadQueue(projectId: string) {
  const refresh = useRefreshSources(projectId);
  const [items, setItems] = useState<UploadItem[]>([]);

  const files = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  const waiting = useRef<string[]>([]);
  const running = useRef(0);
  const counter = useRef(0);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const runOne = useCallback(
    async (id: string, target: Pick<UploadItem, 'documentId'>): Promise<void> => {
      const file = files.current.get(id);
      if (!file) return;
      const controller = new AbortController();
      controllers.current.set(id, controller);
      update(id, { status: 'uploading', progress: 0, error: null, duplicateOf: null });

      try {
        const mimeType = mimeTypeFor(file.name) ?? file.type;
        const { upload } = await apiClient.post<{ upload: UploadUrlDto }>(
          `/projects/${projectId}/documents/upload-url`,
          {
            fileName: file.name,
            mimeType,
            sizeBytes: file.size,
            ...(target.documentId && { documentId: target.documentId }),
          },
        );
        if (controller.signal.aborted) throw new UploadCanceledError();

        await apiClient.upload(upload.uploadUrl, file, mimeType, {
          signal: controller.signal,
          onProgress: (progress) => update(id, { progress }),
        });

        update(id, { status: 'confirming', progress: 100 });
        const result = await apiClient.post<ConfirmUploadDto>(
          `/projects/${projectId}/documents/confirm`,
          { ticket: upload.ticket },
        );
        update(id, { status: 'done', duplicateOf: result.duplicateOf });
        void refreshRef.current();
      } catch (err) {
        if (err instanceof UploadCanceledError || controller.signal.aborted) {
          update(id, { status: 'canceled', progress: 0 });
        } else {
          update(id, { status: 'failed', error: errorMessage(err) });
        }
      } finally {
        controllers.current.delete(id);
      }
    },
    [projectId, update],
  );

  const targets = useRef(new Map<string, Pick<UploadItem, 'documentId'>>());

  const pump = useCallback(() => {
    while (running.current < MAX_PARALLEL_UPLOADS && waiting.current.length > 0) {
      const id = waiting.current.shift();
      if (!id) break;
      running.current += 1;
      void runOne(id, targets.current.get(id) ?? { documentId: null }).finally(() => {
        running.current -= 1;
        pump();
      });
    }
  }, [runOne]);

  const add = useCallback(
    (selected: File[], options: AddFilesOptions = {}) => {
      const created: UploadItem[] = [];
      const known = [...files.current.values()];
      const inBatch: File[] = [];

      for (const file of selected) {
        counter.current += 1;
        const id = `upload-${String(counter.current)}`;
        const problem =
          checkUploadable(file) ??
          (known.some((f) => sameFile(f, file)) || inBatch.some((f) => sameFile(f, file))
            ? 'This file is already in the upload list.'
            : null);

        const item: UploadItem = {
          id,
          fileName: file.name,
          size: file.size,
          status: problem ? 'rejected' : 'queued',
          progress: 0,
          error: problem,
          duplicateOf: null,
          documentId: options.documentId ?? null,
          documentName: options.documentName ?? null,
        };
        created.push(item);
        if (problem) continue;

        inBatch.push(file);
        files.current.set(id, file);
        targets.current.set(id, { documentId: item.documentId });
        waiting.current.push(id);
      }

      setItems((current) => [...current, ...created]);
      pump();
    },
    [pump],
  );

  const cancel = useCallback(
    (id: string) => {
      const queuedAt = waiting.current.indexOf(id);
      if (queuedAt !== -1) {
        waiting.current.splice(queuedAt, 1);
        update(id, { status: 'canceled', progress: 0 });
        return;
      }
      controllers.current.get(id)?.abort();
    },
    [update],
  );

  const retry = useCallback(
    (id: string) => {
      if (!files.current.has(id) || waiting.current.includes(id)) return;
      update(id, { status: 'queued', progress: 0, error: null });
      waiting.current.push(id);
      pump();
    },
    [pump, update],
  );

  const drop = useCallback((predicate: (item: UploadItem) => boolean) => {
    setItems((current) => {
      for (const item of current.filter(predicate)) {
        files.current.delete(item.id);
        targets.current.delete(item.id);
      }
      return current.filter((item) => !predicate(item));
    });
  }, []);

  const dismiss = useCallback(
    (id: string) => drop((item) => item.id === id && isFinished(item.status)),
    [drop],
  );
  const clearFinished = useCallback(() => drop((item) => CLEARABLE.includes(item.status)), [drop]);

  useEffect(() => {
    const active = controllers.current;
    return () => {
      for (const controller of active.values()) controller.abort();
    };
  }, []);

  return {
    items,
    busy: items.some((item) => ACTIVE.includes(item.status)),
    add,
    cancel,
    retry,
    dismiss,
    clearFinished,
  };
}
