import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberDto, ProjectDto } from '@brd/shared';
import { makeAuth, makeUser, renderRoute } from '@/test/render';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));
const auth = vi.hoisted(() => ({ current: {} as ReturnType<typeof makeAuth> }));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiClient: api,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth.current }));

import { ApiClientError } from '@/lib/api-client';
import { ProjectDetailPage } from './ProjectDetailPage';

function project(overrides: Partial<ProjectDto> = {}): ProjectDto {
  return {
    id: 'p1',
    name: 'Alpha',
    description: 'First project',
    status: 'ACTIVE',
    organizationId: 'org1',
    myRole: 'OWNER',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

const MEMBER: MemberDto = {
  userId: 'm1',
  name: 'Mia Analyst',
  email: 'mia@brd.test',
  role: 'ANALYST',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const NO_STATUSES = { CONFIRMED: 0, ASSUMED: 0, OPEN: 0, REJECTED: 0, NEEDS_REVALIDATION: 0 };
const EMPTY_SUMMARY = {
  counts: { requirements: NO_STATUSES, rules: NO_STATUSES, modules: NO_STATUSES },
  chunksNeedingReview: 0,
};

function mockApi(proj: ProjectDto | Error, members: MemberDto[] = [MEMBER]) {
  api.get.mockImplementation(async (url: string) => {
    if (url === '/projects/p1') {
      if (proj instanceof Error) throw proj;
      return { project: proj };
    }
    if (url === '/projects/p1/members') return { members };
    if (url === '/projects/p1/documents?pageSize=100')
      return { items: [], page: 1, pageSize: 100, total: 0 };
    if (url === '/projects/p1/notes?pageSize=100')
      return { items: [], page: 1, pageSize: 100, total: 0 };
    if (url === '/projects/p1/processing-status') {
      return {
        status: {
          counts: { UPLOADED: 0, PROCESSING: 0, PROCESSED: 0, FAILED: 0 },
          active: false,
          sources: [],
        },
      };
    }
    if (url === '/projects/p1/knowledge-summary') return { summary: EMPTY_SUMMARY };
    if (url === '/projects/p1/questions/counts')
      return {
        counts: {
          byStatus: { OPEN: 0, ANSWERED: 0, DISMISSED: 0 },
          openByPriority: { CRITICAL: 0, HIGH: 0, NORMAL: 0 },
          openCritical: 0,
        },
      };
    if (url.startsWith('/projects/p1/questions?'))
      return { items: [], page: 1, pageSize: 200, total: 0 };
    if (url.startsWith('/projects/p1/decisions'))
      return { items: [], page: 1, pageSize: 20, total: 0 };
    if (url === '/projects/p1/summary') return { summary: null, versions: [] };
    if (url === '/projects/p1/members/candidates') {
      return { candidates: [{ userId: 'c1', name: 'Cal', email: 'cal@brd.test' }] };
    }
    throw new Error(`unexpected GET ${url}`);
  });
}

const view = () =>
  renderRoute(<ProjectDetailPage />, {
    path: '/projects/:projectId',
    initialEntry: '/projects/p1',
  });

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    auth.current = makeAuth(
      makeUser({ id: 'me', orgRole: 'MEMBER', role: { id: 'MEMBER', name: 'MEMBER' } }),
    );
  });

  it('shows a loader first, then the overview', async () => {
    mockApi(project());
    view();
    expect(await screen.findByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByText('First project')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('shows not-found for a missing project', async () => {
    mockApi(new ApiClientError(404, 'NOT_FOUND', 'Project not found'));
    view();
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });

  it('shows no-access when forbidden', async () => {
    mockApi(new ApiClientError(403, 'FORBIDDEN', 'nope'));
    view();
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });

  it('shows an error with retry for other failures', async () => {
    mockApi(new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom'));
    view();
    expect(await screen.findByText('Could not load the project')).toBeInTheDocument();
  });

  it('lets an owner manage members', async () => {
    mockApi(project());
    view();
    await screen.findByRole('heading', { name: 'Alpha' });
    await userEvent.click(screen.getByRole('tab', { name: 'Members' }));
    expect(await screen.findByText('Mia Analyst')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('shows an empty members state', async () => {
    mockApi(project(), []);
    view();
    await screen.findByRole('heading', { name: 'Alpha' });
    await userEvent.click(screen.getByRole('tab', { name: 'Members' }));
    expect(await screen.findByText('No members yet')).toBeInTheDocument();
  });

  it('lets analysts and owners add sources, but not viewers or approvers', async () => {
    for (const [role, canAdd] of [
      ['OWNER', true],
      ['ANALYST', true],
      ['APPROVER', false],
      ['VIEWER', false],
    ] as const) {
      mockApi(project({ myRole: role }));
      const { unmount } = view();
      await screen.findByRole('heading', { name: 'Alpha' });
      await userEvent.click(screen.getByRole('tab', { name: 'Sources' }));
      expect(await screen.findByText('No sources yet')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Upload documents' }) !== null).toBe(canAdd);
      expect(screen.queryByRole('button', { name: 'Add context note' }) !== null).toBe(canAdd);
      expect(screen.queryByRole('note') !== null).toBe(!canAdd);
      unmount();
    }
  });

  it('hides member management from roles without the permission', async () => {
    mockApi(project({ myRole: 'VIEWER' }));
    view();
    await screen.findByRole('heading', { name: 'Alpha' });
    expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Members' })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/projects/p1/members');
  });

  it('shows every project tab, with empty states for the data tabs', async () => {
    mockApi(project());
    view();
    await screen.findByRole('heading', { name: 'Alpha' });
    const names = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(names).toEqual([
      'Overview',
      'Sources',
      'Requirements',
      'Rules',
      'Modules',
      'Questions',
      'Decisions',
      'Members',
    ]);
    await userEvent.click(screen.getByRole('tab', { name: 'Questions' }));
    expect(await screen.findByText('No questions yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Decisions' }));
    expect(await screen.findByText('No decisions yet')).toBeInTheDocument();
  });

  it('opens the tab named in the address and keeps the choice there', async () => {
    mockApi(project());
    api.get.mockImplementation(async (url: string) => {
      if (url === '/projects/p1') return { project: project() };
      if (url.startsWith('/projects/p1/requirements')) {
        return { items: [], page: 1, pageSize: 20, total: 0 };
      }
      if (url.startsWith('/projects/p1/modules'))
        return { items: [], page: 1, pageSize: 100, total: 0 };
      if (url.startsWith('/projects/p1/documents') || url.startsWith('/projects/p1/notes')) {
        return { items: [], page: 1, pageSize: 100, total: 0 };
      }
      throw new Error(`unexpected GET ${url}`);
    });
    renderRoute(<ProjectDetailPage />, {
      path: '/projects/:projectId',
      initialEntry: '/projects/p1?tab=requirements',
    });
    expect(await screen.findByText('No requirements yet')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Requirements' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('falls back to Overview for an unknown tab or one the role cannot see', async () => {
    mockApi(project({ myRole: 'VIEWER' }));
    renderRoute(<ProjectDetailPage />, {
      path: '/projects/:projectId',
      initialEntry: '/projects/p1?tab=members',
    });
    await screen.findByRole('heading', { name: 'Alpha' });
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(api.get).not.toHaveBeenCalledWith('/projects/p1/members');
  });

  it('shows a viewer every tab except Members', async () => {
    mockApi(project({ myRole: 'VIEWER' }));
    view();
    await screen.findByRole('heading', { name: 'Alpha' });
    expect(screen.getAllByRole('tab')).toHaveLength(7);
  });

  it('protects the only owner from removal and demotion in the interface', async () => {
    mockApi(project(), [{ ...MEMBER, userId: 'm2', name: 'Olive Owner', role: 'OWNER' }]);
    view();
    await screen.findByRole('heading', { name: 'Alpha' });
    await userEvent.click(screen.getByRole('tab', { name: 'Members' }));
    expect(await screen.findByText('Olive Owner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.getByText('Only owner')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Role for Olive Owner' })).toBeDisabled();
  });

  it('shows the last-owner error from the server next to the table', async () => {
    mockApi(project(), [
      { ...MEMBER, userId: 'm2', name: 'Olive Owner', role: 'OWNER' },
      { ...MEMBER, userId: 'm3', name: 'Otto Owner', role: 'OWNER' },
    ]);
    api.del.mockRejectedValue(
      new ApiClientError(409, 'CONFLICT', 'A project must keep at least one owner'),
    );
    view();
    await screen.findByRole('heading', { name: 'Alpha' });
    await userEvent.click(screen.getByRole('tab', { name: 'Members' }));
    await userEvent.click((await screen.findAllByRole('button', { name: 'Remove' }))[0]!);
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A project must keep at least one owner',
    );
  });

  it('gives organization admins member management without a membership', async () => {
    auth.current = makeAuth(makeUser());
    mockApi(project({ myRole: null }));
    view();
    await screen.findByRole('heading', { name: 'Alpha' });
    expect(screen.getByText('Organization admin')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Members' }));
    expect(await screen.findByText('Mia Analyst')).toBeInTheDocument();
  });

  it('removes a member only after confirmation', async () => {
    mockApi(project());
    api.del.mockResolvedValue(undefined);
    view();
    await screen.findByRole('heading', { name: 'Alpha' });
    await userEvent.click(screen.getByRole('tab', { name: 'Members' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(api.del).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.del).toHaveBeenCalledWith('/projects/p1/members/m1'));
  });

  it('archives the project after confirmation', async () => {
    mockApi(project());
    api.post.mockResolvedValue({ project: project({ status: 'ARCHIVED' }) });
    view();
    await userEvent.click(await screen.findByRole('button', { name: /archive/i }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/projects/p1/archive'));
  });
});
