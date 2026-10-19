import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeAuth, makeUser, renderRoute } from '@/test/render';
import { counts, page, question, summaryResponse } from './question-fixtures';

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

import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage';

const project = {
  id: 'p1',
  name: 'Alpha',
  description: null,
  status: 'ACTIVE',
  organizationId: 'org1',
  myRole: 'ANALYST',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  auth.current = makeAuth(makeUser({ orgRole: 'MEMBER', role: { id: 'MEMBER', name: 'MEMBER' } }));
  api.get.mockImplementation(async (url: string) => {
    if (url === '/projects/p1') return { project };
    if (url === '/projects/p1/questions/counts') return { counts: counts({ openCritical: 2 }) };
    if (url.startsWith('/projects/p1/questions?'))
      return page([question({ priority: 'CRITICAL' })]);
    if (url === '/projects/p1/summary') return summaryResponse();
    if (url === '/projects/p1/processing-status') {
      return {
        status: {
          counts: { UPLOADED: 0, PROCESSING: 0, PROCESSED: 0, FAILED: 0 },
          active: false,
          lastProcessedAt: null,
          sources: [],
        },
      };
    }
    if (url === '/projects/p1/knowledge-summary') {
      const zero = { CONFIRMED: 0, ASSUMED: 0, OPEN: 0, REJECTED: 0, NEEDS_REVALIDATION: 0 };
      return {
        summary: {
          counts: { requirements: zero, rules: zero, modules: zero },
          chunksNeedingReview: 0,
        },
      };
    }
    throw new Error(`unexpected GET ${url}`);
  });
});

describe('critical questions shortcut', () => {
  it('shows the open critical count on the Overview and the open count on the tab', async () => {
    renderRoute(<ProjectDetailPage />, {
      path: '/projects/:projectId',
      initialEntry: '/projects/p1',
    });
    expect(await screen.findByTestId('critical-count')).toHaveTextContent('2');
    expect(await screen.findByRole('tab', { name: /Questions/ })).toHaveTextContent('2');
  });

  it('jumps to the Questions tab filtered to critical questions', async () => {
    renderRoute(<ProjectDetailPage />, {
      path: '/projects/:projectId',
      initialEntry: '/projects/p1',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Review critical questions' }));

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Questions/ })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/projects/p1/questions?page=1&pageSize=50&status=OPEN&priority=CRITICAL',
      ),
    );
    expect(await screen.findByRole('button', { name: 'Filters, applied' })).toBeInTheDocument();
  });

  it('keeps the filter in the address so the view can be shared', async () => {
    renderRoute(<ProjectDetailPage />, {
      path: '/projects/:projectId',
      initialEntry: '/projects/p1?tab=questions&questions.priority=CRITICAL',
    });
    await screen.findByText('What happens to unpaid invoices?');
    expect(api.get).toHaveBeenCalledWith(
      '/projects/p1/questions?page=1&pageSize=50&status=OPEN&priority=CRITICAL',
    );
  });
});
