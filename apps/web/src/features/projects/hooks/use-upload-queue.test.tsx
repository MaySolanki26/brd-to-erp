import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MAX_UPLOAD_BYTES } from '@brd/shared';

const api = vi.hoisted(() => ({ post: vi.fn(), upload: vi.fn() }));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiClient: api,
}));

import { ApiClientError, UploadCanceledError } from '@/lib/api-client';
import { MAX_PARALLEL_UPLOADS, useUploadQueue } from './use-upload-queue';

const PDF = 'application/pdf';

interface PendingUpload {
  fileName: string;
  progress: (percent: number) => void;
  finish: () => void;
  fail: (error: Error) => void;
  signal: AbortSignal;
}

let pending: PendingUpload[] = [];
let invalidate: ReturnType<typeof vi.fn>;

function file(name: string, size = 10, lastModified = 1): File {
  return new File([new Uint8Array(size)], name, { type: PDF, lastModified });
}

function scriptApi(options: { duplicateOf?: { documentId: string; title: string } } = {}) {
  api.post.mockImplementation(async (url: string, body: { fileName?: string }) => {
    if (url.endsWith('/upload-url')) {
      return {
        upload: {
          uploadUrl: `http://storage.test/${body.fileName ?? ''}`,
          ticket: `ticket-${body.fileName ?? ''}`,
          expiresAt: 'x',
        },
      };
    }
    return { document: {}, duplicateOf: options.duplicateOf ?? null };
  });
  api.upload.mockImplementation(
    (
      url: string,
      _file: File,
      _mime: string,
      opts: { signal: AbortSignal; onProgress: (p: number) => void },
    ) =>
      new Promise<void>((resolve, reject) => {
        const entry: PendingUpload = {
          fileName: url.split('/').pop() ?? '',
          progress: opts.onProgress,
          finish: resolve,
          fail: reject,
          signal: opts.signal,
        };
        opts.signal.addEventListener('abort', () => reject(new UploadCanceledError()));
        pending.push(entry);
      }),
  );
}

function setup() {
  const client = new QueryClient();
  invalidate = vi.fn().mockResolvedValue(undefined);
  client.invalidateQueries = invalidate as unknown as typeof client.invalidateQueries;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useUploadQueue('p1'), { wrapper });
}

const statuses = (items: { fileName: string; status: string }[]) =>
  Object.fromEntries(items.map((i) => [i.fileName, i.status]));
const upload = (name: string): PendingUpload =>
  pending.find((p) => p.fileName === name) as PendingUpload;

describe('useUploadQueue', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pending = [];
    scriptApi();
  });

  it('uploads a file through the signed-URL flow, reporting progress until done', async () => {
    const { result } = setup();
    act(() => result.current.add([file('a.pdf', 20)]));

    await waitFor(() => expect(result.current.items[0]?.status).toBe('uploading'));
    expect(api.post).toHaveBeenCalledWith('/projects/p1/documents/upload-url', {
      fileName: 'a.pdf',
      mimeType: PDF,
      sizeBytes: 20,
    });
    await waitFor(() => expect(pending).toHaveLength(1));
    expect(api.upload).toHaveBeenCalledWith(
      'http://storage.test/a.pdf',
      expect.any(File),
      PDF,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    act(() => upload('a.pdf').progress(40));
    expect(result.current.items[0]?.progress).toBe(40);
    expect(result.current.busy).toBe(true);

    act(() => upload('a.pdf').finish());
    await waitFor(() => expect(result.current.items[0]?.status).toBe('done'));
    expect(api.post).toHaveBeenLastCalledWith('/projects/p1/documents/confirm', {
      ticket: 'ticket-a.pdf',
    });
    expect(invalidate).toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });

  it('rejects unsupported, empty and oversized files with a reason and never calls the API', () => {
    const { result } = setup();
    const huge = file('big.pdf');
    Object.defineProperty(huge, 'size', { value: MAX_UPLOAD_BYTES + 1 });

    act(() => result.current.add([file('notes.txt'), file('empty.pdf', 0), huge]));

    expect(result.current.items.map((i) => i.status)).toEqual(['rejected', 'rejected', 'rejected']);
    expect(result.current.items[0]?.error).toMatch(/Unsupported file/);
    expect(result.current.items[1]?.error).toMatch(/empty/);
    expect(result.current.items[2]?.error).toMatch(/larger than 25 MB/);
    expect(api.post).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });

  it('skips the same file dropped twice, in one batch or later', async () => {
    const { result } = setup();
    act(() => result.current.add([file('a.pdf'), file('a.pdf')]));
    expect(result.current.items.map((i) => i.status)).toEqual(['uploading', 'rejected']);
    expect(result.current.items[1]?.error).toMatch(/already in the upload list/);

    act(() => result.current.add([file('a.pdf')]));
    expect(result.current.items[2]?.status).toBe('rejected');
    await waitFor(() => expect(pending).toHaveLength(1));
  });

  it('treats files with the same name but different content as different', async () => {
    const { result } = setup();
    act(() => result.current.add([file('a.pdf', 10), file('a.pdf', 11)]));
    await waitFor(() => expect(pending).toHaveLength(2));
  });

  it(`runs at most ${String(MAX_PARALLEL_UPLOADS)} uploads at a time and starts the next as one finishes`, async () => {
    const { result } = setup();
    act(() => result.current.add([file('a.pdf', 1), file('b.pdf', 2), file('c.pdf', 3)]));

    await waitFor(() => expect(pending).toHaveLength(2));
    expect(statuses(result.current.items)).toEqual({
      'a.pdf': 'uploading',
      'b.pdf': 'uploading',
      'c.pdf': 'queued',
    });

    act(() => upload('a.pdf').finish());
    await waitFor(() => expect(pending).toHaveLength(3));
    expect(result.current.items.find((i) => i.fileName === 'c.pdf')?.status).toBe('uploading');
  });

  it('cancels a queued file without contacting the API', async () => {
    const { result } = setup();
    act(() => result.current.add([file('a.pdf', 1), file('b.pdf', 2), file('c.pdf', 3)]));
    await waitFor(() => expect(pending).toHaveLength(2));

    const queued = result.current.items.find((i) => i.fileName === 'c.pdf');
    act(() => result.current.cancel(queued?.id ?? ''));

    expect(result.current.items.find((i) => i.fileName === 'c.pdf')?.status).toBe('canceled');
    act(() => {
      upload('a.pdf').finish();
      upload('b.pdf').finish();
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(pending).toHaveLength(2);
  });

  it('aborts an upload in flight, never confirms it, and frees the slot', async () => {
    const { result } = setup();
    act(() => result.current.add([file('a.pdf', 1), file('b.pdf', 2), file('c.pdf', 3)]));
    await waitFor(() => expect(pending).toHaveLength(2));

    act(() => result.current.cancel(result.current.items[0]?.id ?? ''));

    await waitFor(() => expect(result.current.items[0]?.status).toBe('canceled'));
    expect(upload('a.pdf').signal.aborted).toBe(true);
    expect(api.post).not.toHaveBeenCalledWith(
      '/projects/p1/documents/confirm',
      expect.objectContaining({ ticket: 'ticket-a.pdf' }),
    );
    await waitFor(() => expect(pending).toHaveLength(3));
  });

  it('stops before sending bytes when canceled while the upload URL is being requested', async () => {
    let release: (value: unknown) => void = () => undefined;
    api.post.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    const { result } = setup();
    act(() => result.current.add([file('a.pdf')]));
    await waitFor(() => expect(api.post).toHaveBeenCalled());

    act(() => result.current.cancel(result.current.items[0]?.id ?? ''));
    release({ upload: { uploadUrl: 'http://storage.test/a.pdf', ticket: 't', expiresAt: 'x' } });

    await waitFor(() => expect(result.current.items[0]?.status).toBe('canceled'));
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('marks a failed upload with the server message and retries it from a fresh URL', async () => {
    const { result } = setup();
    act(() => result.current.add([file('a.pdf')]));
    await waitFor(() => expect(pending).toHaveLength(1));

    act(() =>
      upload('a.pdf').fail(
        new ApiClientError(400, 'VALIDATION_ERROR', 'The file content does not match its type'),
      ),
    );
    await waitFor(() => expect(result.current.items[0]?.status).toBe('failed'));
    expect(result.current.items[0]?.error).toBe('The file content does not match its type');

    const id = result.current.items[0]?.id ?? '';
    act(() => result.current.retry(id));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(api.post.mock.calls.filter((c) => String(c[0]).endsWith('/upload-url'))).toHaveLength(2);
    expect(result.current.items[0]).toMatchObject({
      status: 'uploading',
      error: null,
      progress: 0,
    });

    act(() => pending[1]?.finish());
    await waitFor(() => expect(result.current.items[0]?.status).toBe('done'));
  });

  it('can retry a canceled upload', async () => {
    const { result } = setup();
    act(() => result.current.add([file('a.pdf')]));
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => result.current.cancel(result.current.items[0]?.id ?? ''));
    await waitFor(() => expect(result.current.items[0]?.status).toBe('canceled'));

    act(() => result.current.retry(result.current.items[0]?.id ?? ''));
    await waitFor(() => expect(pending).toHaveLength(2));
  });

  it('keeps the duplicate warning the server returned', async () => {
    scriptApi({ duplicateOf: { documentId: 'd9', title: 'old.pdf' } });
    const { result } = setup();
    act(() => result.current.add([file('a.pdf')]));
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => upload('a.pdf').finish());
    await waitFor(() => expect(result.current.items[0]?.status).toBe('done'));
    expect(result.current.items[0]?.duplicateOf).toEqual({ documentId: 'd9', title: 'old.pdf' });
  });

  it('uploads as a new version of the chosen document', async () => {
    const { result } = setup();
    act(() => result.current.add([file('a.pdf')], { documentId: 'd1', documentName: 'brd.pdf' }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0]?.[1]).toMatchObject({ documentId: 'd1' });
    expect(result.current.items[0]).toMatchObject({ documentId: 'd1', documentName: 'brd.pdf' });
  });

  it('dismisses only finished items and clears everything that is not failed or active', async () => {
    const { result } = setup();
    act(() => result.current.add([file('a.pdf', 1), file('notes.txt'), file('b.pdf', 2)]));
    await waitFor(() => expect(pending).toHaveLength(2));
    act(() => upload('a.pdf').finish());
    act(() => upload('b.pdf').fail(new Error('boom')));
    await waitFor(() =>
      expect(statuses(result.current.items)).toMatchObject({ 'a.pdf': 'done', 'b.pdf': 'failed' }),
    );

    act(() => result.current.clearFinished());
    expect(result.current.items.map((i) => i.fileName)).toEqual(['b.pdf']);

    act(() => result.current.dismiss(result.current.items[0]?.id ?? ''));
    expect(result.current.items).toEqual([]);
  });

  it('refuses to dismiss an upload that is still running', async () => {
    const { result } = setup();
    act(() => result.current.add([file('a.pdf')]));
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => result.current.dismiss(result.current.items[0]?.id ?? ''));
    expect(result.current.items).toHaveLength(1);
  });

  it('aborts uploads in flight when the component unmounts', async () => {
    const { result, unmount } = setup();
    act(() => result.current.add([file('a.pdf')]));
    await waitFor(() => expect(pending).toHaveLength(1));
    unmount();
    expect(upload('a.pdf').signal.aborted).toBe(true);
  });
});
