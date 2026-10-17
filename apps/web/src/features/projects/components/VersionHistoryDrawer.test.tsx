import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DocumentDetailDto } from '@brd/shared';
import { makeAuth, makeUser, renderRoute } from '@/test/render';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  upload: vi.fn(),
}));
const auth = vi.hoisted(() => ({ current: {} as ReturnType<typeof makeAuth> }));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiClient: api,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth.current }));

import { ApiClientError } from '@/lib/api-client';
import { VersionHistoryDrawer } from './VersionHistoryDrawer';
import { doc, person, version } from './test-data';

function detail(versions = [version()]): { document: DocumentDetailDto } {
  const base = doc({ latestVersion: versions[0] ?? version(), versionCount: versions.length });
  return {
    document: {
      ...base,
      versions,
      chunksVersionId: versions[0]?.id ?? 'v1',
      chunks: { items: [], page: 1, pageSize: 20, total: 0 },
    },
  };
}

const view = (documentId: string | null = 'd1', onViewChunks = vi.fn(), onClose = vi.fn()) => {
  renderRoute(
    <VersionHistoryDrawer
      projectId="p1"
      documentId={documentId}
      onClose={onClose}
      onViewChunks={onViewChunks}
    />,
  );
  return { onViewChunks, onClose };
};

describe('VersionHistoryDrawer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.current = makeAuth(makeUser());
  });

  it('does not load anything while closed', () => {
    view(null);
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a loading state, then the versions newest first with one Current marker', async () => {
    api.get.mockResolvedValue(
      detail([
        version({
          id: 'v3',
          versionNumber: 3,
          createdBy: person('Cara'),
          sizeBytes: 3 * 1024 * 1024,
          contentHash: 'ccccdddd9999',
        }),
        version({ id: 'v2', versionNumber: 2, createdBy: person('Bob') }),
        version({ id: 'v1', versionNumber: 1 }),
      ]),
    );
    view();
    const dialog = await screen.findByRole('dialog');
    const items = await within(dialog).findAllByRole('listitem');
    expect(items.map((i) => i.querySelector('span')?.textContent)).toEqual([
      'Version 3',
      'Version 2',
      'Version 1',
    ]);
    expect(within(dialog).getAllByText('Current')).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Cara');
    expect(items[0]).toHaveTextContent('3.0 MB');
    expect(items[0]).toHaveTextContent('hash ccccdddd');
    expect(items[0]).toHaveTextContent('Current');
    expect(items[1]).not.toHaveTextContent('Current');
  });

  it('links each version to its own download', async () => {
    api.get.mockResolvedValue(
      detail([version({ id: 'v2', versionNumber: 2 }), version({ id: 'v1' })]),
    );
    view();
    expect(await screen.findByRole('link', { name: 'Download version 2' })).toHaveAttribute(
      'href',
      '/api/projects/p1/documents/d1/versions/v2/download',
    );
    expect(screen.getByRole('link', { name: 'Download version 1' })).toHaveAttribute(
      'href',
      '/api/projects/p1/documents/d1/versions/v1/download',
    );
  });

  it('opens the chunks of the chosen version', async () => {
    api.get.mockResolvedValue(
      detail([version({ id: 'v2', versionNumber: 2 }), version({ id: 'v1' })]),
    );
    const { onViewChunks } = view();
    await userEvent.click(await screen.findByRole('button', { name: 'View chunks of version 1' }));
    expect(onViewChunks).toHaveBeenCalledWith('d1', 'v1');
  });

  it('says so when there is only one version', async () => {
    api.get.mockResolvedValue(detail());
    view();
    expect(await screen.findByText(/only version/)).toBeInTheDocument();
  });

  it('shows an error with a working retry', async () => {
    api.get.mockRejectedValueOnce(new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom'));
    view();
    expect(await screen.findByText('Could not load versions')).toBeInTheDocument();
    api.get.mockResolvedValueOnce(detail());
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Version 1')).toBeInTheDocument();
  });
});
