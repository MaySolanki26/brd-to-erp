import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ChunkDto,
  ContextNoteDto,
  DocumentDetailDto,
  DocumentDto,
  ProcessingStatusDto,
} from '@brd/shared';
import { makeAuth, makeUser, renderRoute } from '@/test/render';

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

import { ApiClientError } from '@/lib/api-client';
import { SourcesTab } from './SourcesTab';

const PID = 'p1';
const DOCS_URL = `/projects/${PID}/documents?pageSize=100`;
const NOTES_URL = `/projects/${PID}/notes?pageSize=100`;
const STATUS_URL = `/projects/${PID}/processing-status`;
const PDF = 'application/pdf';

function person() {
  return { id: 'u1', name: 'Ann Analyst' };
}

function doc(overrides: Partial<DocumentDto> = {}): DocumentDto {
  return {
    id: 'd1',
    title: 'brd.pdf',
    fileName: 'brd.pdf',
    status: 'PROCESSED',
    failureReason: null,
    latestVersion: {
      id: 'v1',
      versionNumber: 1,
      mimeType: PDF,
      sizeBytes: 2048,
      contentHash: 'h',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: person(),
    },
    versionCount: 1,
    chunkCount: 4,
    createdBy: person(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function note(overrides: Partial<ContextNoteDto> = {}): ContextNoteDto {
  return {
    id: 'n1',
    title: 'Kickoff call',
    body: '# Goals\nCut errors.',
    status: 'PROCESSED',
    failureReason: null,
    chunkCount: 1,
    createdBy: person(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

const paged = <T,>(items: T[]) => ({ items, page: 1, pageSize: 100, total: items.length });

function status(active = false): { status: ProcessingStatusDto } {
  return {
    status: {
      counts: { UPLOADED: active ? 1 : 0, PROCESSING: 0, PROCESSED: 1, FAILED: 0 },
      active,
      sources: [],
    },
  };
}

function mockLists(docs: DocumentDto[] = [doc()], notes: ContextNoteDto[] = [note()]) {
  api.get.mockImplementation(async (url: string) => {
    if (url === DOCS_URL) return paged(docs);
    if (url === NOTES_URL) return paged(notes);
    if (url === STATUS_URL) return status();
    throw new Error(`unexpected GET ${url}`);
  });
}

const view = (props: { canAddSource?: boolean; canReprocess?: boolean } = {}) =>
  renderRoute(
    <SourcesTab
      projectId={PID}
      canAddSource={props.canAddSource ?? true}
      canReprocess={props.canReprocess ?? true}
    />,
  );

describe('SourcesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.current = makeAuth(makeUser());
    mockLists();
  });

  describe('states', () => {
    it('shows loading placeholders before data arrives', () => {
      api.get.mockReturnValue(new Promise(() => {}));
      view();
      expect(screen.getByRole('heading', { name: 'Documents' })).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('shows an error with retry when documents fail to load', async () => {
      api.get.mockImplementation(async (url: string) => {
        if (url === DOCS_URL) throw new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom');
        if (url === NOTES_URL) return paged([]);
        return status();
      });
      view();
      expect(await screen.findByText('Could not load documents')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('shows no-access when the API forbids reading sources', async () => {
      api.get.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'nope'));
      view();
      expect(await screen.findByText('Access restricted')).toBeInTheDocument();
    });

    it('shows an empty state with an upload action for people who can add sources', async () => {
      mockLists([], []);
      view();
      expect(await screen.findByText('No documents yet')).toBeInTheDocument();
      expect(screen.getByText('No notes yet')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Upload document' }).length).toBeGreaterThan(0);
    });

    it('shows a read-only empty state for people who cannot add sources', async () => {
      mockLists([], []);
      view({ canAddSource: false });
      expect(await screen.findByText('No documents yet')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Upload document' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add note' })).not.toBeInTheDocument();
    });
  });

  describe('listing', () => {
    it('shows documents with status, chunk count, uploader and a download link', async () => {
      mockLists([
        doc(),
        doc({
          id: 'd2',
          title: 'scan.pdf',
          status: 'FAILED',
          failureReason: 'OCR not supported. This PDF has no selectable text.',
          chunkCount: 0,
        }),
      ]);
      view();
      expect(await screen.findByText('brd.pdf')).toBeInTheDocument();
      expect(screen.getAllByText('Processed').length).toBeGreaterThan(0);
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText(/OCR not supported/)).toBeInTheDocument();
      const link = screen.getAllByRole('link', { name: 'Download' })[0];
      expect(link).toHaveAttribute('href', '/api/projects/p1/documents/d1/versions/v1/download');
    });

    it('shows notes with their status', async () => {
      mockLists([], [note({ status: 'UPLOADED' })]);
      view();
      expect(await screen.findByText('Kickoff call')).toBeInTheDocument();
      expect(screen.getByText('Queued')).toBeInTheDocument();
    });
  });

  describe('role gating', () => {
    it('hides every write action for read-only roles', async () => {
      view({ canAddSource: false, canReprocess: false });
      await screen.findByText('brd.pdf');
      expect(screen.queryByRole('button', { name: 'Upload document' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'New version' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reprocess' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: 'Download' }).length).toBe(1);
    });

    it('offers reprocess only for finished documents, and only with the permission', async () => {
      mockLists([
        doc({ id: 'a', title: 'done.pdf' }),
        doc({ id: 'b', title: 'busy.pdf', status: 'PROCESSING' }),
      ]);
      view();
      await screen.findByText('done.pdf');
      expect(screen.getAllByRole('button', { name: 'Reprocess' })).toHaveLength(1);
    });

    it('lets analysts upload but not reprocess when reprocess is not granted', async () => {
      view({ canAddSource: true, canReprocess: false });
      await screen.findByText('brd.pdf');
      expect(screen.getByRole('button', { name: 'Upload document' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reprocess' })).not.toBeInTheDocument();
    });
  });

  describe('uploading', () => {
    const picker = () => screen.getByLabelText('Choose a file to upload') as HTMLInputElement;

    function scriptUpload(duplicateOf: { documentId: string; title: string } | null = null) {
      api.post.mockImplementation(async (url: string) => {
        if (url.endsWith('/upload-url')) {
          return {
            upload: {
              uploadUrl: 'http://storage.test/upload?token=t',
              ticket: 'tk',
              expiresAt: 'x',
            },
          };
        }
        if (url.endsWith('/confirm')) return { document: doc({ status: 'UPLOADED' }), duplicateOf };
        throw new Error(`unexpected POST ${url}`);
      });
      api.upload.mockResolvedValue(undefined);
    }

    it('requests a signed URL, uploads the file to it and confirms with the ticket', async () => {
      scriptUpload();
      view();
      await screen.findByText('brd.pdf');

      const file = new File(['%PDF-1.4 hello'], 'new.pdf', { type: PDF });
      await userEvent.upload(picker(), file);

      await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
      expect(api.post).toHaveBeenNthCalledWith(1, '/projects/p1/documents/upload-url', {
        fileName: 'new.pdf',
        mimeType: PDF,
        sizeBytes: file.size,
      });
      expect(api.upload).toHaveBeenCalledWith('http://storage.test/upload?token=t', file, PDF);
      expect(api.post).toHaveBeenNthCalledWith(2, '/projects/p1/documents/confirm', {
        ticket: 'tk',
      });
      expect(toastMock.success).toHaveBeenCalled();
      expect(toastMock.warning).not.toHaveBeenCalled();
    });

    it('uses the extension, not the browser-reported type, for Office files', async () => {
      scriptUpload();
      view();
      await screen.findByText('brd.pdf');
      await userEvent.upload(picker(), new File(['PK'], 'spec.docx', { type: '' }));
      await waitFor(() => expect(api.post).toHaveBeenCalled());
      expect(api.post.mock.calls[0]?.[1]).toMatchObject({
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    });

    it('warns when the content already exists in the project', async () => {
      scriptUpload({ documentId: 'd9', title: 'old.pdf' });
      view();
      await screen.findByText('brd.pdf');
      await userEvent.upload(picker(), new File(['x'], 'copy.pdf', { type: PDF }));
      await waitFor(() => expect(toastMock.warning).toHaveBeenCalled());
      expect(String(toastMock.warning.mock.calls[0]?.[0])).toContain('old.pdf');
    });

    it('rejects unsupported files without calling the API', async () => {
      const user = userEvent.setup({ applyAccept: false });
      view();
      await screen.findByText('brd.pdf');
      await user.upload(picker(), new File(['x'], 'notes.txt', { type: 'text/plain' }));
      expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/Unsupported file/));
      expect(api.post).not.toHaveBeenCalled();
    });

    it('shows the server message when the upload is rejected', async () => {
      api.post.mockRejectedValue(
        new ApiClientError(400, 'VALIDATION_ERROR', 'The file content does not match its type'),
      );
      view();
      await screen.findByText('brd.pdf');
      await userEvent.upload(picker(), new File(['x'], 'bad.pdf', { type: PDF }));
      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith('The file content does not match its type'),
      );
    });

    it('uploads a new version against the chosen document', async () => {
      scriptUpload();
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'New version' }));
      await userEvent.upload(picker(), new File(['x'], 'brd.pdf', { type: PDF }));
      await waitFor(() => expect(api.post).toHaveBeenCalled());
      expect(api.post.mock.calls[0]?.[1]).toMatchObject({ documentId: 'd1' });
    });
  });

  describe('reprocessing', () => {
    it('re-queues a document', async () => {
      mockLists([doc({ status: 'FAILED' })]);
      api.post.mockResolvedValue({ document: doc({ status: 'UPLOADED' }) });
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'Reprocess' }));
      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/projects/p1/documents/d1/reprocess'),
      );
    });

    it('shows the server message when reprocessing fails', async () => {
      mockLists([doc({ status: 'FAILED' })]);
      api.post.mockRejectedValue(
        new ApiClientError(
          409,
          'CONFLICT',
          'Only processed or failed documents can be reprocessed',
        ),
      );
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'Reprocess' }));
      await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    });
  });

  describe('notes', () => {
    it('adds a note and validates it first', async () => {
      mockLists([], []);
      api.post.mockResolvedValue({ note: note() });
      view();
      await screen.findByText('No notes yet');

      await userEvent.click(screen.getByRole('button', { name: 'Add note' }));
      await userEvent.click(
        await screen
          .findByRole('button', { name: 'Add note', hidden: false })
          .catch(() => screen.getAllByRole('button', { name: 'Add note' })[1] as HTMLElement),
      );
      expect(await screen.findByText('Title is required')).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();

      await userEvent.type(screen.getByLabelText('Title'), 'Call');
      await userEvent.type(screen.getByLabelText('Note'), 'We agreed on scope.');
      const buttons = screen.getAllByRole('button', { name: 'Add note' });
      await userEvent.click(buttons[buttons.length - 1] as HTMLElement);

      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/projects/p1/notes', {
          title: 'Call',
          body: 'We agreed on scope.',
        }),
      );
    });

    it('shows the character counter against the limit', async () => {
      mockLists([], []);
      view();
      await screen.findByText('No notes yet');
      await userEvent.click(screen.getByRole('button', { name: 'Add note' }));
      await userEvent.type(await screen.findByLabelText('Note'), 'abc');
      expect(screen.getByText('3 / 20,000 characters')).toBeInTheDocument();
    });

    it('edits an existing note with its current text', async () => {
      api.patch.mockResolvedValue({ note: note() });
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      const title = (await screen.findByLabelText('Title')) as HTMLInputElement;
      expect(title.value).toBe('Kickoff call');

      await userEvent.clear(title);
      await userEvent.type(title, 'Kickoff v2');
      await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
      await waitFor(() =>
        expect(api.patch).toHaveBeenCalledWith('/projects/p1/notes/n1', {
          title: 'Kickoff v2',
          body: '# Goals\nCut errors.',
        }),
      );
    });
  });

  describe('document details', () => {
    const chunk = (i: number): ChunkDto => ({
      id: `c${String(i)}`,
      chunkIndex: i,
      headingPath: ['Order to Cash', 'Invoicing'],
      content: `Chunk body ${String(i)}`,
    });

    function detail(overrides: Partial<DocumentDetailDto> = {}): { document: DocumentDetailDto } {
      const base = doc();
      return {
        document: {
          ...base,
          versions: [base.latestVersion],
          chunksVersionId: 'v1',
          chunks: { items: [chunk(0), chunk(1)], page: 1, pageSize: 20, total: 2 },
          ...overrides,
        },
      };
    }

    function mockDetail(result: { document: DocumentDetailDto }) {
      api.get.mockImplementation(async (url: string) => {
        if (url === DOCS_URL) return paged([doc()]);
        if (url === NOTES_URL) return paged([]);
        if (url === STATUS_URL) return status();
        if (url.startsWith('/projects/p1/documents/d1?')) return result;
        throw new Error(`unexpected GET ${url}`);
      });
    }

    it('opens a drawer listing chunks with their heading paths', async () => {
      mockDetail(detail());
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'brd.pdf' }));
      expect(await screen.findByText('Chunk body 0')).toBeInTheDocument();
      expect(screen.getAllByText(/Order to Cash › Invoicing/).length).toBe(2);
    });

    it('explains an empty chunk list', async () => {
      mockDetail(
        detail({ chunks: { items: [], page: 1, pageSize: 20, total: 0 }, status: 'UPLOADED' }),
      );
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'brd.pdf' }));
      expect(await screen.findByText('No chunks for this version')).toBeInTheDocument();
      expect(screen.getByText('Chunks appear once processing finishes.')).toBeInTheDocument();
    });

    it('shows the failure reason', async () => {
      mockDetail(
        detail({
          status: 'FAILED',
          failureReason: 'OCR not supported. This PDF has no selectable text.',
          chunks: { items: [], page: 1, pageSize: 20, total: 0 },
        }),
      );
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'brd.pdf' }));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(/OCR not supported/);
    });

    it('pages through chunks', async () => {
      mockDetail(detail({ chunks: { items: [chunk(0)], page: 1, pageSize: 20, total: 45 } }));
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'brd.pdf' }));
      expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('page=2')));
    });

    it('shows an error with retry when the document cannot be loaded', async () => {
      api.get.mockImplementation(async (url: string) => {
        if (url === DOCS_URL) return paged([doc()]);
        if (url === NOTES_URL) return paged([]);
        if (url === STATUS_URL) return status();
        throw new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom');
      });
      view();
      await userEvent.click(await screen.findByRole('button', { name: 'brd.pdf' }));
      expect(await screen.findByText('Could not load the document')).toBeInTheDocument();
    });
  });

  describe('live status', () => {
    it('keeps polling while sources are queued or running', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        api.get.mockImplementation(async (url: string) => {
          if (url === DOCS_URL) return paged([doc({ status: 'PROCESSING' })]);
          if (url === NOTES_URL) return paged([]);
          return status(true);
        });
        view();
        await screen.findByText('Processing');
        const statusCalls = () => api.get.mock.calls.filter((c) => c[0] === STATUS_URL).length;
        const before = statusCalls();
        await vi.advanceTimersByTimeAsync(3500);
        await waitFor(() => expect(statusCalls()).toBeGreaterThan(before));
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not poll once everything has finished', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        view();
        await screen.findByText('brd.pdf');
        const statusCalls = () => api.get.mock.calls.filter((c) => c[0] === STATUS_URL).length;
        const before = statusCalls();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(statusCalls()).toBe(before);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
