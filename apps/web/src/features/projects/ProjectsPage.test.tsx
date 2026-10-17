import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectDto } from '@brd/shared';
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
import { ProjectsPage } from './ProjectsPage';

function project(overrides: Partial<ProjectDto> = {}): ProjectDto {
  return {
    id: 'p1',
    name: 'Alpha',
    description: null,
    status: 'ACTIVE',
    organizationId: 'org1',
    myRole: 'OWNER',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const page = (items: ProjectDto[]) => ({ items, page: 1, pageSize: 50, total: items.length });

describe('ProjectsPage', () => {
  beforeEach(() => {
    auth.current = makeAuth(makeUser());
  });

  it('shows a loading state, then the projects', async () => {
    api.get.mockResolvedValue(page([project()]));
    renderRoute(<ProjectsPage />, { path: '/projects' });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('labels admin access when the user has no membership', async () => {
    api.get.mockResolvedValue(page([project({ myRole: null })]));
    renderRoute(<ProjectsPage />, { path: '/projects' });
    expect(await screen.findByText('Admin access')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    api.get.mockResolvedValue(page([]));
    renderRoute(<ProjectsPage />, { path: '/projects' });
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('searches by name from the first page', async () => {
    api.get.mockResolvedValue(page([project()]));
    renderRoute(<ProjectsPage />, { path: '/projects' });
    await screen.findByText('Alpha');

    await userEvent.type(screen.getByRole('textbox', { name: 'Search projects' }), 'alp');

    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('search=alp')),
    );
    expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('page=1'));
  });

  it('explains an empty search and clears it', async () => {
    api.get.mockImplementation(async (url: string) =>
      url.includes('search=zzz') ? page([]) : page([project()]),
    );
    renderRoute(<ProjectsPage />, { path: '/projects' });
    await screen.findByText('Alpha');

    await userEvent.type(screen.getByRole('textbox', { name: 'Search projects' }), 'zzz');
    expect(await screen.findByText('No matching projects')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show all projects' }));
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('No matching projects')).not.toBeInTheDocument();
  });

  it('pages through long lists and hides pagination for short ones', async () => {
    const many = Array.from({ length: 20 }, (_, i) => project({ id: `p${i}`, name: `Proj ${i}` }));
    api.get.mockImplementation(async (url: string) =>
      url.includes('page=2')
        ? { items: [project({ id: 'last', name: 'Last one' })], page: 2, pageSize: 20, total: 21 }
        : { items: many, page: 1, pageSize: 20, total: 21 },
    );
    renderRoute(<ProjectsPage />, { path: '/projects' });
    await screen.findByText('Proj 0');

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByText('Last one')).toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('page=2'));
  });

  it('shows no pagination when everything fits on one page', async () => {
    api.get.mockResolvedValue(page([project()]));
    renderRoute(<ProjectsPage />, { path: '/projects' });
    await screen.findByText('Alpha');
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument();
  });

  it('shows an error with retry', async () => {
    api.get.mockRejectedValue(new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom'));
    renderRoute(<ProjectsPage />, { path: '/projects' });
    expect(await screen.findByText('Could not load projects')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows no-access when the API forbids listing', async () => {
    api.get.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'nope'));
    renderRoute(<ProjectsPage />, { path: '/projects' });
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });

  it('opens a project when its row is clicked', async () => {
    api.get.mockResolvedValue(page([project()]));
    renderRoute(<ProjectsPage />, { path: '/projects' });
    await userEvent.click(await screen.findByText('Alpha'));
    expect(await screen.findByTestId('location')).toHaveTextContent('/projects/p1');
  });

  it('creates a project and navigates to it', async () => {
    api.get.mockResolvedValue(page([]));
    api.post.mockResolvedValue({ project: project({ id: 'new', name: 'Beta' }) });
    renderRoute(<ProjectsPage />, { path: '/projects' });
    await screen.findByText('No projects yet');

    await userEvent.click(
      screen.getAllByRole('button', { name: /new project/i })[0] as HTMLElement,
    );
    await userEvent.type(await screen.findByLabelText('Name'), 'Beta');
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/projects', { name: 'Beta' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/projects/new');
  });

  it('requires a name', async () => {
    api.get.mockResolvedValue(page([]));
    renderRoute(<ProjectsPage />, { path: '/projects' });
    await screen.findByText('No projects yet');

    await userEvent.click(
      screen.getAllByRole('button', { name: /new project/i })[0] as HTMLElement,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
