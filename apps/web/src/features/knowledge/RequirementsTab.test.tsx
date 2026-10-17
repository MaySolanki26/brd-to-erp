import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '@/test/render';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiClient: api,
}));

import { ApiClientError } from '@/lib/api-client';
import {
  DOC_ID,
  MODULE_ID,
  NOTE_ID,
  SOURCE_LISTS,
  moduleItem,
  page,
  requirement,
  source,
} from './knowledge-fixtures';
import { RequirementsTab } from './components/RequirementsTab';

const CHUNK = {
  id: 'c1',
  chunkIndex: 0,
  headingPath: ['1. Scope', '1.1 Invoicing'],
  content: 'The system shall invoice every active customer monthly.',
  needsReview: false,
  source: { type: 'document', sourceId: DOC_ID, sourceTitle: 'Billing BRD', versionNumber: 1 },
};

type Handler = (url: string) => unknown;

function mockApi(requirements: Handler, chunk: Handler = () => ({ chunk: CHUNK })) {
  api.get.mockImplementation(async (url: string) => {
    if (url.startsWith('/projects/p1/requirements')) return requirements(url);
    if (url.startsWith('/projects/p1/modules')) return page([moduleItem()]);
    if (url.startsWith('/projects/p1/documents')) return SOURCE_LISTS.documents;
    if (url.startsWith('/projects/p1/notes')) return SOURCE_LISTS.notes;
    if (url.startsWith('/projects/p1/chunks/')) return chunk(url);
    throw new Error(`unexpected GET ${url}`);
  });
}

const view = (initialEntry = '/projects/p1') =>
  renderRoute(<RequirementsTab projectId="p1" />, { path: '/projects/:projectId', initialEntry });

const lastRequirementsUrl = (): string =>
  [...api.get.mock.calls]
    .map((c) => c[0] as string)
    .reverse()
    .find((u) => u.startsWith('/projects/p1/requirements')) ?? '';

describe('RequirementsTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows a skeleton first, then each requirement with status, module, source and author', async () => {
    mockApi(() => page([requirement()]));
    view();
    expect(screen.queryByText('Monthly invoice run')).not.toBeInTheDocument();

    expect(await screen.findByText('Monthly invoice run')).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Monthly invoice run/ });
    expect(within(row).getByText('Confirmed')).toBeInTheDocument();
    expect(within(row).getByText('Billing')).toBeInTheDocument();
    expect(within(row).getByText('AI extraction')).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: /View source: Billing BRD v1, 1\.1 Invoicing/ }),
    ).toBeInTheDocument();
  });

  it('names the person when someone added or edited the item', async () => {
    mockApi(() => page([requirement({ createdBy: { id: 'u9', name: 'Ann Analyst' } })]));
    view();
    expect(await screen.findByText('Ann Analyst')).toBeInTheDocument();
  });

  it('highlights items that need revalidation or whose source needs review, and only those', async () => {
    mockApi(() =>
      page([
        requirement({ id: 'a', title: 'Fine one' }),
        requirement({ id: 'b', title: 'Stale one', status: 'NEEDS_REVALIDATION' }),
        requirement({ id: 'c', title: 'Unclear one', source: source({ needsReview: true }) }),
      ]),
    );
    view();
    await screen.findByText('Stale one');

    expect(screen.getByRole('row', { name: /Fine one/ })).not.toHaveClass('row-attention');
    const stale = screen.getByRole('row', { name: /Stale one/ });
    expect(stale).toHaveClass('row-attention');
    expect(within(stale).getByText('Needs revalidation')).toBeInTheDocument();
    const unclear = screen.getByRole('row', { name: /Unclear one/ });
    expect(unclear).toHaveClass('row-attention');
    expect(within(unclear).getByText('Source needs review')).toBeInTheDocument();
  });

  it('shows an empty state when nothing has been extracted', async () => {
    mockApi(() => page([]));
    view();
    expect(await screen.findByText('No requirements yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows an error with retry', async () => {
    let calls = 0;
    mockApi(() => {
      calls += 1;
      if (calls === 1) throw new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom');
      return page([requirement()]);
    });
    view();
    expect(await screen.findByText('boom')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry|try again/i }));
    expect(await screen.findByText('Monthly invoice run')).toBeInTheDocument();
  });

  it('shows no-access when the API forbids it', async () => {
    mockApi(() => {
      throw new ApiClientError(403, 'FORBIDDEN', 'no');
    });
    view();
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });

  describe('filters', () => {
    beforeEach(() => {
      mockApi(() => page([requirement()]));
    });

    it('filters by status', async () => {
      view();
      await screen.findByText('Monthly invoice run');

      await userEvent.click(screen.getByRole('combobox', { name: 'Filter by status' }));
      await userEvent.click(await screen.findByRole('option', { name: 'Needs revalidation' }));

      await waitFor(() => expect(lastRequirementsUrl()).toContain('status=NEEDS_REVALIDATION'));
      expect(lastRequirementsUrl()).toContain('page=1');
    });

    it('filters by module', async () => {
      view();
      await screen.findByText('Monthly invoice run');
      await waitFor(() =>
        expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/modules')),
      );

      await userEvent.click(screen.getByRole('combobox', { name: 'Filter by module' }));
      await userEvent.click(await screen.findByRole('option', { name: 'Billing' }));

      await waitFor(() => expect(lastRequirementsUrl()).toContain(`moduleId=${MODULE_ID}`));
    });

    it('filters by source, offering documents and notes', async () => {
      view();
      await screen.findByText('Monthly invoice run');
      await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/notes')));

      await userEvent.click(screen.getByRole('combobox', { name: 'Filter by source' }));
      expect(await screen.findByRole('option', { name: 'Billing BRD' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('option', { name: 'Kickoff call (note)' }));

      await waitFor(() => expect(lastRequirementsUrl()).toContain(`sourceId=${NOTE_ID}`));
    });

    it('searches after a short pause', async () => {
      view();
      await screen.findByText('Monthly invoice run');
      await userEvent.type(screen.getByRole('textbox', { name: 'Search requirements' }), 'tax');
      await waitFor(() => expect(lastRequirementsUrl()).toContain('search=tax'));
    });

    it('restores filters from the address, so a view can be shared', async () => {
      view(`/projects/p1?requirements.status=ASSUMED&requirements.q=vat&requirements.page=2`);
      await screen.findByText('Monthly invoice run');
      const url = lastRequirementsUrl();
      expect(url).toContain('status=ASSUMED');
      expect(url).toContain('search=vat');
      expect(url).toContain('page=2');
    });

    it('ignores invalid values in the address', async () => {
      view(`/projects/p1?requirements.status=BOGUS&requirements.page=-3&requirements.module=nope`);
      await screen.findByText('Monthly invoice run');
      const url = lastRequirementsUrl();
      expect(url).not.toContain('status=');
      expect(url).not.toContain('moduleId=');
      expect(url).toContain('page=1');
    });

    it('explains an empty result and clears the filters', async () => {
      mockApi((url) => (url.includes('status=REJECTED') ? page([]) : page([requirement()])));
      view();
      await screen.findByText('Monthly invoice run');

      await userEvent.click(screen.getByRole('combobox', { name: 'Filter by status' }));
      await userEvent.click(await screen.findByRole('option', { name: 'Rejected' }));
      expect(await screen.findByText('No matching requirements')).toBeInTheDocument();

      const clear = screen.getAllByRole('button', { name: 'Clear filters' });
      await userEvent.click(clear[0] as HTMLElement);
      expect(await screen.findByText('Monthly invoice run')).toBeInTheDocument();
      expect(screen.queryByText('No matching requirements')).not.toBeInTheDocument();
    });
  });

  it('pages through results', async () => {
    mockApi((url) =>
      url.includes('page=2')
        ? {
            items: [requirement({ id: 'z', title: 'Second page item' })],
            page: 2,
            pageSize: 20,
            total: 21,
          }
        : { items: [requirement()], page: 1, pageSize: 20, total: 21 },
    );
    view();
    await screen.findByText('Monthly invoice run');

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByText('Second page item')).toBeInTheDocument();
    expect(lastRequirementsUrl()).toContain('page=2');
  });

  describe('items merged from several sources', () => {
    it('shows how many other places state the same thing and opens each of them', async () => {
      const kickoff = source({
        chunkId: 'c7',
        type: 'note',
        sourceId: NOTE_ID,
        sourceTitle: 'Kickoff call',
        versionNumber: null,
        headingPath: ['Decisions'],
      });
      mockApi(() => page([requirement({ otherSources: [kickoff] })]));
      view();
      await screen.findByText('Monthly invoice run');

      await userEvent.click(screen.getByRole('button', { name: '+1 more source' }));
      expect(await screen.findByText('Also found in')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /View source: Kickoff call/ }));

      await screen.findByRole('dialog');
      expect(api.get).toHaveBeenCalledWith('/projects/p1/chunks/c7');
    });

    it('shows no extra-source control for an item found in one place', async () => {
      mockApi(() => page([requirement()]));
      view();
      await screen.findByText('Monthly invoice run');
      expect(screen.queryByRole('button', { name: /more source/ })).not.toBeInTheDocument();
    });
  });

  describe('source drawer', () => {
    const openDrawer = async () => {
      await screen.findByText('Monthly invoice run');
      await userEvent.click(screen.getByRole('button', { name: /View source: Billing BRD/ }));
    };

    it('opens the exact chunk text with its heading path and source', async () => {
      mockApi(() => page([requirement()]));
      view();
      await openDrawer();

      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByText(CHUNK.content)).toBeInTheDocument();
      expect(within(dialog).getByText('1. Scope › 1.1 Invoicing')).toBeInTheDocument();
      expect(within(dialog).getByText('Billing BRD')).toBeInTheDocument();
      expect(within(dialog).getByText(/Document · version 1 · section 1/)).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith('/projects/p1/chunks/c1');
    });

    it('does not open the drawer for a click elsewhere on the row', async () => {
      mockApi(() => page([requirement()]));
      view();
      await userEvent.click(await screen.findByText('Monthly invoice run'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('warns when the chunk could not be read cleanly', async () => {
      mockApi(
        () => page([requirement({ source: source({ needsReview: true }) })]),
        () => ({ chunk: { ...CHUNK, needsReview: true } }),
      );
      view();
      await openDrawer();
      expect(await screen.findByText(/could not be read cleanly, so items/)).toBeInTheDocument();
    });

    it('says so when the source no longer exists', async () => {
      mockApi(
        () => page([requirement()]),
        () => {
          throw new ApiClientError(404, 'NOT_FOUND', 'Chunk not found');
        },
      );
      view();
      await openDrawer();
      expect(await screen.findByText('Source not available')).toBeInTheDocument();
    });

    it('shows an error with retry for other failures', async () => {
      let calls = 0;
      mockApi(
        () => page([requirement()]),
        () => {
          calls += 1;
          if (calls === 1) throw new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'chunk boom');
          return { chunk: CHUNK };
        },
      );
      view();
      await openDrawer();
      expect(await screen.findByText('chunk boom')).toBeInTheDocument();
      const dialog = screen.getByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: /retry|try again/i }));
      expect(await within(dialog).findByText(CHUNK.content)).toBeInTheDocument();
    });
  });
});
