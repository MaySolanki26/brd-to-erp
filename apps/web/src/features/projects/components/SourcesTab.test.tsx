import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChunkDto, ContextNoteDto, DocumentDetailDto, DocumentDto } from '@brd/shared';
import { makeAuth, makeUser, renderRoute } from '@/test/render';
import { PDF, doc, note, paged, processingStatus, version } from './test-data';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  upload: vi.fn(),
}));
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
const auth = vi.hoisted(() => ({ current: {} as ReturnType<typeof makeAuth> }));

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiClient: api,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth.current }));
vi.mock('@brd/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@brd/ui')>()),
  toast: toastMock,
}));

import { ApiClientError, UploadCanceledError } from '@/lib/api-client';
import { SourcesTab } from './SourcesTab';

const docsUrl = (id: string) => `/projects/${id}/documents?pageSize=100`;
const notesUrl = (id: string) => `/projects/${id}/notes?pageSize=100`;
const statusUrl = (id: string) => `/projects/${id}/processing-status`;

interface World {
  docs?: DocumentDto[];
  notes?: ContextNoteDto[];
  active?: boolean;
  detail?: DocumentDetailDto;
}

function mockProject(id: string, world: World = {}) {
  const { docs = [doc()], notes = [note()], active = false, detail } = world;
  return async (url: string): Promise<unknown> => {
    if (url === docsUrl(id)) return paged(docs);
    if (url === notesUrl(id)) return paged(notes);
    if (url === statusUrl(id)) return processingStatus(active);
    if (url.startsWith(`/projects/${id}/documents/`) && detail) return { document: detail };
    throw new Error(`unexpected GET ${url}`);
  };
}

function useWorld(world: World = {}) {
  api.get.mockImplementation(mockProject('p1', world));
}

const chunk = (i: number): ChunkDto => ({
  id: `c${String(i)}`,
  chunkIndex: i,
  headingPath: ['Order to Cash'],
  content: `Chunk body ${String(i)}`,
});

function detailOf(versions = [version()], chunks = [chunk(0)]): DocumentDetailDto {
  const base = doc({ latestVersion: versions[0] ?? version(), versionCount: versions.length });
  return {
    ...base,
    versions,
    chunksVersionId: versions[0]?.id ?? 'v1',
    chunks: { items: chunks, page: 1, pageSize: 20, total: chunks.length },
  };
}

const view = (props: { canAddSource?: boolean; canReprocess?: boolean } = {}) =>
  renderRoute(
    <SourcesTab
      projectId="p1"
      canAddSource={props.canAddSource ?? true}
      canReprocess={props.canReprocess ?? true}
    />,
  );

const pdfFile = (name = 'new.pdf', size = 20) =>
  new File([new Uint8Array(size)], name, { type: PDF, lastModified: 1 });

function scriptUpload(duplicateOf: { documentId: string; title: string } | null = null) {
  api.post.mockImplementation(async (url: string) => {
    if (url.endsWith('/upload-url')) {
      return {
        upload: { uploadUrl: 'http://storage.test/upload?token=t', ticket: 'tk', expiresAt: 'x' },
      };
    }
    if (url.endsWith('/confirm')) return { document: doc({ status: 'UPLOADED' }), duplicateOf };
    throw new Error(`unexpected POST ${url}`);
  });
  api.upload.mockResolvedValue(undefined);
}

const dropZone = () => screen.getByRole('button', { name: 'Upload documents' });

describe('SourcesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.current = makeAuth(makeUser());
    useWorld();
  });

  describe('states', () => {
    it('shows loading placeholders before data arrives', () => {
      api.get.mockReturnValue(new Promise(() => {}));
      view();
      expect(screen.getByRole('heading', { name: 'Sources' })).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('shows an error with a retry that reloads both lists', async () => {
      api.get.mockImplementation(async (url: string) => {
        if (url === docsUrl('p1')) throw new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom');
        return url === notesUrl('p1') ? paged([]) : processingStatus();
      });
      view();
      expect(await screen.findByText('Could not load sources')).toBeInTheDocument();

      useWorld();
      await userEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(await screen.findByText('brd.pdf')).toBeInTheDocument();
    });

    it('shows no-access when the API forbids reading sources', async () => {
      api.get.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'nope'));
      view();
      expect(await screen.findByText('Access restricted')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Upload documents' })).not.toBeInTheDocument();
    });

    it('invites people who can add sources to upload when nothing exists yet', async () => {
      useWorld({ docs: [], notes: [] });
      view();
      expect(await screen.findByText('No sources yet')).toBeInTheDocument();
      expect(screen.getByText(/Drop a PDF, DOCX or XLSX above/)).toBeInTheDocument();
      expect(dropZone()).toBeInTheDocument();
    });

    it('shows a read-only empty state for people who cannot add sources', async () => {
      useWorld({ docs: [], notes: [] });
      view({ canAddSource: false });
      expect(await screen.findByText('No sources yet')).toBeInTheDocument();
      expect(screen.getByText(/added by analysts and owners/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Upload documents' })).not.toBeInTheDocument();
    });
  });

  describe('list', () => {
    it('shows documents and notes together', async () => {
      view();
      expect(await screen.findByText('brd.pdf')).toBeInTheDocument();
      expect(screen.getByText('Kickoff call')).toBeInTheDocument();
      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('Note')).toBeInTheDocument();
    });
  });

  describe('read-only roles (viewer, approver)', () => {
    it('shows sources and the read-only hint but no way to add or change anything', async () => {
      view({ canAddSource: false, canReprocess: false });
      expect(await screen.findByText('brd.pdf')).toBeInTheDocument();

      expect(screen.getByRole('note')).toHaveTextContent('You can view sources but not add them.');
      for (const name of [
        'Upload documents',
        'Add context note',
        /new version/i,
        /Edit note/,
        /Reprocess/,
      ]) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      }
      expect(screen.queryByLabelText('Choose files to upload')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Version history/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Download/ })).toBeInTheDocument();
    });

    it('lets analysts add sources but only reprocess when that permission is granted', async () => {
      view({ canAddSource: true, canReprocess: false });
      await screen.findByText('brd.pdf');
      expect(dropZone()).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add context note' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reprocess/ })).not.toBeInTheDocument();
    });
  });

  describe('project isolation', () => {
    it('never shows another project’s sources after switching projects', async () => {
      api.get.mockImplementation(async (url: string) => {
        if (url.includes('/projects/p1/'))
          return mockProject('p1', {
            docs: [doc({ title: 'alpha.pdf', fileName: 'alpha.pdf' })],
            notes: [note({ title: 'alpha note' })],
          })(url);
        return mockProject('p2', {
          docs: [doc({ id: 'd2', title: 'beta.pdf', fileName: 'beta.pdf' })],
          notes: [],
        })(url);
      });
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const tree = (id: string) => (
        <QueryClientProvider client={client}>
          <SourcesTab projectId={id} canAddSource canReprocess />
        </QueryClientProvider>
      );

      const { rerender } = render(tree('p1'));
      expect(await screen.findByText('alpha.pdf')).toBeInTheDocument();
      expect(screen.getByText('alpha note')).toBeInTheDocument();

      rerender(tree('p2'));
      expect(await screen.findByText('beta.pdf')).toBeInTheDocument();
      expect(screen.queryByText('alpha.pdf')).not.toBeInTheDocument();
      expect(screen.queryByText('alpha note')).not.toBeInTheDocument();
      expect(
        api.get.mock.calls.filter((c) => String(c[0]).includes('/projects/p2/')).length,
      ).toBeGreaterThan(0);
    });
  });

  describe('uploading', () => {
    it('uploads dropped files with progress and shows them in the list afterwards', async () => {
      scriptUpload();
      let finish: () => void = () => undefined;
      api.upload.mockImplementation(
        (_url: string, _file: File, _mime: string, opts: { onProgress: (p: number) => void }) =>
          new Promise<void>((resolve) => {
            opts.onProgress(55);
            finish = resolve;
          }),
      );
      view();
      await screen.findByText('brd.pdf');

      fireEvent.drop(dropZone(), { dataTransfer: { files: [pdfFile()] } });

      expect(await screen.findByText('Uploading 55%')).toBeInTheDocument();
      expect(
        screen.getByRole('progressbar', { name: 'Upload progress for new.pdf' }),
      ).toHaveAttribute('aria-valuenow', '55');
      expect(api.post).toHaveBeenCalledWith('/projects/p1/documents/upload-url', {
        fileName: 'new.pdf',
        mimeType: PDF,
        sizeBytes: 20,
      });

      finish();
      expect(
        await screen.findByText('Uploaded. Processing will start shortly.'),
      ).toBeInTheDocument();
      expect(api.post).toHaveBeenLastCalledWith('/projects/p1/documents/confirm', { ticket: 'tk' });
      expect(api.upload).toHaveBeenCalledWith(
        'http://storage.test/upload?token=t',
        expect.any(File),
        PDF,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('accepts files chosen with the picker and several at once', async () => {
      scriptUpload();
      view();
      await screen.findByText('brd.pdf');
      await userEvent.upload(screen.getByLabelText('Choose files to upload'), [
        pdfFile('a.pdf', 1),
        pdfFile('b.pdf', 2),
      ]);
      await waitFor(() => expect(api.upload).toHaveBeenCalledTimes(2));
    });

    it('rejects unsupported files inline without contacting the API', async () => {
      view();
      await screen.findByText('brd.pdf');
      fireEvent.drop(dropZone(), {
        dataTransfer: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] },
      });
      expect(await screen.findByRole('alert')).toHaveTextContent(/Unsupported file/);
      expect(api.post).not.toHaveBeenCalled();
    });

    it('cancels an upload in flight and offers a retry that succeeds', async () => {
      scriptUpload();
      api.upload.mockImplementationOnce(
        (_u: string, _f: File, _m: string, opts: { signal: AbortSignal }) =>
          new Promise<void>((_resolve, reject) => {
            opts.signal.addEventListener('abort', () => reject(new UploadCanceledError()));
          }),
      );
      view();
      await screen.findByText('brd.pdf');
      fireEvent.drop(dropZone(), { dataTransfer: { files: [pdfFile()] } });

      await userEvent.click(
        await screen.findByRole('button', { name: 'Cancel upload of new.pdf' }),
      );
      expect(await screen.findByText('Canceled')).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalledWith(
        '/projects/p1/documents/confirm',
        expect.anything(),
      );

      api.upload.mockResolvedValue(undefined);
      await userEvent.click(screen.getByRole('button', { name: 'Retry upload of new.pdf' }));
      expect(
        await screen.findByText('Uploaded. Processing will start shortly.'),
      ).toBeInTheDocument();
    });

    it('shows a failure from the server with a retry', async () => {
      api.post.mockRejectedValue(
        new ApiClientError(400, 'VALIDATION_ERROR', 'The file content does not match its type'),
      );
      view();
      await screen.findByText('brd.pdf');
      fireEvent.drop(dropZone(), { dataTransfer: { files: [pdfFile('bad.pdf')] } });
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The file content does not match its type',
      );
      expect(screen.getByRole('button', { name: 'Retry upload of bad.pdf' })).toBeInTheDocument();
    });

    it('keeps a visible duplicate warning that opens the original document', async () => {
      scriptUpload({ documentId: 'd9', title: 'old.pdf' });
      useWorld({ detail: detailOf() });
      view();
      await screen.findByText('brd.pdf');
      fireEvent.drop(dropZone(), { dataTransfer: { files: [pdfFile('copy.pdf')] } });

      expect(await screen.findByText(/Identical content already exists in/)).toHaveTextContent(
        'old.pdf',
      );
      await userEvent.click(screen.getByRole('button', { name: 'View original' }));
      await waitFor(() =>
        expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/projects/p1/documents/d9?')),
      );
    });

    it('uploads a new version of the chosen document', async () => {
      scriptUpload();
      view();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Upload a new version of brd.pdf' }),
      );
      await userEvent.upload(
        screen.getByLabelText('Choose a file for the new version'),
        pdfFile('brd-v2.pdf'),
      );
      await waitFor(() => expect(api.post).toHaveBeenCalled());
      expect(api.post.mock.calls[0]?.[1]).toMatchObject({
        documentId: 'd1',
        fileName: 'brd-v2.pdf',
      });
      expect(await screen.findByText(/new version of brd\.pdf/)).toBeInTheDocument();
    });
  });

  describe('reprocessing', () => {
    it('asks first, then re-queues the document', async () => {
      useWorld({ docs: [doc({ status: 'FAILED' })], notes: [] });
      api.post.mockResolvedValue({ document: doc({ status: 'UPLOADED' }) });
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'Reprocess brd.pdf' }));
      expect(api.post).not.toHaveBeenCalled();

      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Reprocess' }));
      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/projects/p1/documents/d1/reprocess'),
      );
      await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    });

    it('shows the server message when reprocessing is refused', async () => {
      useWorld({ docs: [doc({ status: 'FAILED' })], notes: [] });
      api.post.mockRejectedValue(
        new ApiClientError(
          409,
          'CONFLICT',
          'Only processed or failed documents can be reprocessed',
        ),
      );
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'Reprocess brd.pdf' }));
      await userEvent.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reprocess' }),
      );
      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith(
          'Only processed or failed documents can be reprocessed',
        ),
      );
    });
  });

  describe('context notes', () => {
    it('adds a note and validates it first', async () => {
      useWorld({ docs: [], notes: [] });
      api.post.mockResolvedValue({ note: note() });
      view();
      await screen.findByText('No sources yet');

      await userEvent.click(screen.getByRole('button', { name: 'Add context note' }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add note' }));
      expect(await within(dialog).findByText('Title is required')).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();

      await userEvent.type(within(dialog).getByLabelText('Title'), 'Call');
      await userEvent.type(within(dialog).getByLabelText('Note'), 'We agreed on scope.');
      expect(within(dialog).getByText('19 / 20,000 characters')).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add note' }));

      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/projects/p1/notes', {
          title: 'Call',
          body: 'We agreed on scope.',
        }),
      );
    });

    it('edits an existing note with its current text', async () => {
      api.patch.mockResolvedValue({ note: note() });
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'Edit note Kickoff call' }));
      const dialog = await screen.findByRole('dialog');
      const title = within(dialog).getByLabelText('Title') as HTMLInputElement;
      expect(title.value).toBe('Kickoff call');

      await userEvent.clear(title);
      await userEvent.type(title, 'Kickoff v2');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save note' }));
      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith('/projects/p1/notes/n1', {
          title: 'Kickoff v2',
          body: '# Goals\nCut errors.',
        }),
      );
    });
  });

  describe('drawers', () => {
    it('opens the chunks of a document', async () => {
      useWorld({ detail: detailOf() });
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'brd.pdf' }));
      expect(await screen.findByText('Chunk body 0')).toBeInTheDocument();
    });

    it('opens version history, then the chunks of an older version', async () => {
      useWorld({
        detail: detailOf([version({ id: 'v2', versionNumber: 2 }), version({ id: 'v1' })]),
      });
      view();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Version history for brd.pdf' }),
      );
      const history = await screen.findByRole('dialog');
      expect(await within(history).findByText('Version 2')).toBeInTheDocument();
      expect(within(history).getByText('Version 1')).toBeInTheDocument();

      await userEvent.click(
        within(history).getByRole('button', { name: 'View chunks of version 1' }),
      );
      await waitFor(() =>
        expect(api.get).toHaveBeenCalledWith(expect.stringContaining('versionId=v1')),
      );
    });
  });

  describe('live status', () => {
    it('keeps polling while sources are queued or running', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        useWorld({ docs: [doc({ status: 'PROCESSING' })], notes: [], active: true });
        view();
        await screen.findByText('Processing');
        const calls = () => api.get.mock.calls.filter((c) => c[0] === statusUrl('p1')).length;
        const before = calls();
        await vi.advanceTimersByTimeAsync(3500);
        await waitFor(() => expect(calls()).toBeGreaterThan(before));
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not poll once everything has finished', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        view();
        await screen.findByText('brd.pdf');
        const calls = () => api.get.mock.calls.filter((c) => c[0] === statusUrl('p1')).length;
        const before = calls();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(calls()).toBe(before);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
