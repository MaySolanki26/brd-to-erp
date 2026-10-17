import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProcessingStatusDto, ProjectDto } from '@brd/shared';
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
import { OverviewTab } from '@/features/projects/components/OverviewTab';
import { summary } from './knowledge-fixtures';

const project: ProjectDto = {
  id: 'p1',
  name: 'Alpha',
  description: 'First project',
  status: 'ACTIVE',
  organizationId: 'org1',
  myRole: 'OWNER',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function status(overrides: Partial<ProcessingStatusDto> = {}): ProcessingStatusDto {
  return {
    counts: { UPLOADED: 0, PROCESSING: 0, PROCESSED: 3, FAILED: 1 },
    active: false,
    lastProcessedAt: '2026-03-04T10:30:00.000Z',
    sources: [],
    ...overrides,
  };
}

type Result = unknown;
function mockApi(processing: () => Result, knowledge: () => Result) {
  api.get.mockImplementation(async (url: string) => {
    if (url === '/projects/p1/processing-status') return processing();
    if (url === '/projects/p1/knowledge-summary') return knowledge();
    if (url === '/projects/p1/questions/counts')
      return {
        counts: {
          byStatus: { OPEN: 0, ANSWERED: 0, DISMISSED: 0 },
          openByPriority: { CRITICAL: 0, HIGH: 0, NORMAL: 0 },
          openCritical: 0,
        },
      };
    if (url === '/projects/p1/summary') return { summary: null, versions: [] };
    throw new Error(`unexpected GET ${url}`);
  });
}

const view = () =>
  renderRoute(
    <OverviewTab project={project} canRefreshSummary={false} onOpenQuestions={vi.fn()} />,
  );

describe('OverviewTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('still shows the project details', async () => {
    mockApi(
      () => ({ status: status() }),
      () => ({ summary: summary() }),
    );
    view();
    expect(await screen.findByText('First project')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('shows processing progress, counts per status and the last processed time', async () => {
    mockApi(
      () => ({ status: status() }),
      () => ({ summary: summary() }),
    );
    view();

    expect(await screen.findByText('3 of 4 sources processed')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Sources processed' })).toBeInTheDocument();
    expect(screen.getByText(/Last processed .*2026/)).toBeInTheDocument();
  });

  it('says when work is still running', async () => {
    mockApi(
      () => ({
        status: status({
          counts: { UPLOADED: 1, PROCESSING: 1, PROCESSED: 2, FAILED: 0 },
          active: true,
        }),
      }),
      () => ({ summary: summary() }),
    );
    view();
    expect(await screen.findByText(/2 of 4 sources processed · working/)).toBeInTheDocument();
  });

  it('says nothing has finished yet when there is no processed time', async () => {
    mockApi(
      () => ({
        status: status({
          counts: { UPLOADED: 2, PROCESSING: 0, PROCESSED: 0, FAILED: 0 },
          active: true,
          lastProcessedAt: null,
        }),
      }),
      () => ({ summary: summary() }),
    );
    view();
    expect(await screen.findByText('Nothing has finished processing yet.')).toBeInTheDocument();
  });

  it('shows an empty state when there are no sources', async () => {
    mockApi(
      () => ({
        status: status({
          counts: { UPLOADED: 0, PROCESSING: 0, PROCESSED: 0, FAILED: 0 },
          lastProcessedAt: null,
        }),
      }),
      () => ({ summary: summary() }),
    );
    view();
    expect(await screen.findByText('No sources yet')).toBeInTheDocument();
  });

  it('counts requirements, rules and modules by status', async () => {
    const none = { CONFIRMED: 0, ASSUMED: 0, OPEN: 0, REJECTED: 0, NEEDS_REVALIDATION: 0 };
    mockApi(
      () => ({ status: status() }),
      () => ({
        summary: summary({
          counts: {
            requirements: { ...none, CONFIRMED: 5, NEEDS_REVALIDATION: 2 },
            rules: { ...none, OPEN: 3 },
            modules: none,
          },
          chunksNeedingReview: 2,
        }),
      }),
    );
    view();

    const requirements = await screen.findByRole('row', { name: /^Requirements/ });
    const cells = within(requirements).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual(['Requirements', '5', '0', '0', '0', '2']);
    const rules = screen.getByRole('row', { name: /^Rules/ });
    expect(within(rules).getAllByRole('cell')[3]?.textContent).toBe('3');
    expect(
      screen.getByText(/2 parts of your sources could not be read cleanly/),
    ).toBeInTheDocument();
  });

  it('shows one part in the singular and nothing when no part needs review', async () => {
    mockApi(
      () => ({ status: status() }),
      () => ({ summary: summary({ chunksNeedingReview: 1 }) }),
    );
    const { unmount } = view();
    expect(await screen.findByText(/1 part of your sources could not be read/)).toBeInTheDocument();
    unmount();

    mockApi(
      () => ({ status: status() }),
      () => ({ summary: summary() }),
    );
    view();
    await screen.findByRole('row', { name: /^Requirements/ });
    expect(screen.queryByText(/could not be read cleanly/)).not.toBeInTheDocument();
  });

  it('retries each panel on its own when it fails', async () => {
    let knowledgeCalls = 0;
    mockApi(
      () => ({ status: status() }),
      () => {
        knowledgeCalls += 1;
        if (knowledgeCalls === 1)
          throw new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'counts boom');
        return { summary: summary() };
      },
    );
    view();

    expect(await screen.findByText('counts boom')).toBeInTheDocument();
    expect(screen.getByText('3 of 4 sources processed')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /retry|try again/i }));
    expect(await screen.findByRole('row', { name: /^Requirements/ })).toBeInTheDocument();
  });

  it('shows an error for processing status without hiding the counts', async () => {
    mockApi(
      () => {
        throw new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'status boom');
      },
      () => ({ summary: summary() }),
    );
    view();
    expect(await screen.findByText('status boom')).toBeInTheDocument();
    expect(await screen.findByRole('row', { name: /^Requirements/ })).toBeInTheDocument();
  });
});
