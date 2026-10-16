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

function mockApi(proj: ProjectDto | Error, members: MemberDto[] = [MEMBER]) {
  api.get.mockImplementation(async (url: string) => {
    if (url === '/projects/p1') {
      if (proj instanceof Error) throw proj;
      return { project: proj };
    }
    if (url === '/projects/p1/members') return { members };
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

  it('hides member management from roles without the permission', async () => {
    mockApi(project({ myRole: 'VIEWER' }));
    view();
    await screen.findByRole('heading', { name: 'Alpha' });
    expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Members' }));
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/projects/p1/members');
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
