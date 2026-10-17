# Tests

> Every file below was compiled, linted and tested in a scratch copy of this repository (2026-10-17). Copy it, then rename. Paths are relative to the repository root.

### `apps/web/src/features/milestones/components/MilestonesTab.test.tsx`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MilestoneDto } from '@brd/shared';
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
import { MilestonesTab } from './MilestonesTab';

function milestone(overrides: Partial<MilestoneDto> = {}): MilestoneDto {
  return {
    id: 'm1',
    title: 'Go live',
    dueDate: '2026-06-30',
    status: 'PLANNED',
    createdBy: { id: 'u1', name: 'Ann' },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const page = (items: MilestoneDto[], total = items.length) => ({
  items,
  page: 1,
  pageSize: 20,
  total,
});
const member = () =>
  makeAuth(makeUser({ orgRole: 'MEMBER', role: { id: 'MEMBER', name: 'MEMBER' } }));

function view(projectRole: 'OWNER' | 'VIEWER' | null = 'OWNER') {
  return renderRoute(<MilestonesTab projectId="p1" projectRole={projectRole} />, {
    path: '/projects/:id',
    initialEntry: '/projects/p1',
  });
}

describe('MilestonesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.current = member();
    api.get.mockResolvedValue(page([milestone()]));
  });

  describe('states', () => {
    it('shows a skeleton while loading', () => {
      api.get.mockReturnValue(new Promise(() => {}));
      view();
      expect(screen.getByRole('heading', { name: 'Milestones' })).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('explains an empty list', async () => {
      api.get.mockResolvedValue(page([]));
      view();
      expect(await screen.findByText('No milestones yet')).toBeInTheDocument();
    });

    it('shows an error with a working retry', async () => {
      api.get.mockRejectedValueOnce(new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom'));
      view();
      expect(await screen.findByText('Could not load milestones')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(await screen.findByText('Go live')).toBeInTheDocument();
    });

    it('shows no-access when the API forbids reading', async () => {
      api.get.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'nope'));
      view();
      expect(await screen.findByText('Access restricted')).toBeInTheDocument();
    });

    it('lists the milestones with their date and status', async () => {
      api.get.mockResolvedValue(page([milestone(), milestone({ id: 'm2', title: 'Kickoff', dueDate: null })]));
      view();
      expect(await screen.findByText('Go live')).toBeInTheDocument();
      expect(screen.getByText('2026-06-30')).toBeInTheDocument();
      expect(screen.getByText('No date')).toBeInTheDocument();
    });
  });

  describe('permissions', () => {
    it('shows the add button to a project owner', async () => {
      view('OWNER');
      expect(await screen.findByRole('button', { name: /new milestone/i })).toBeInTheDocument();
    });

    it('hides it from a viewer', async () => {
      view('VIEWER');
      await screen.findByText('Go live');
      expect(screen.queryByRole('button', { name: /new milestone/i })).not.toBeInTheDocument();
    });
  });

  describe('adding a milestone', () => {
    it('checks the form, saves, closes and refreshes the list', async () => {
      api.post.mockResolvedValue({ milestone: milestone({ id: 'm3', title: 'Beta' }) });
      view();
      await userEvent.click(await screen.findByRole('button', { name: /new milestone/i }));

      await userEvent.click(screen.getByRole('button', { name: 'Add milestone' }));
      expect(await screen.findByText('Title is required')).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();

      await userEvent.type(screen.getByLabelText('Title'), 'Beta');
      await userEvent.click(screen.getByRole('button', { name: 'Add milestone' }));

      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/projects/p1/milestones', {
          title: 'Beta',
          dueDate: null,
        }),
      );
      await waitFor(() => expect(screen.queryByLabelText('Title')).not.toBeInTheDocument());
      expect(api.get.mock.calls.length).toBeGreaterThan(1);
    });

    it('shows the server error inside the drawer', async () => {
      api.post.mockRejectedValue(new ApiClientError(409, 'CONFLICT', 'Already exists'));
      view();
      await userEvent.click(await screen.findByRole('button', { name: /new milestone/i }));
      await userEvent.type(screen.getByLabelText('Title'), 'Beta');
      await userEvent.click(screen.getByRole('button', { name: 'Add milestone' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Already exists');
    });
  });
});
```

### `apps/web/src/features/projects/ProjectSettingsPage.test.tsx`

```ts
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
import { ProjectSettingsPage } from './ProjectSettingsPage';

function project(overrides: Partial<ProjectDto> = {}): ProjectDto {
  return {
    id: 'p1',
    name: 'Alpha',
    description: 'First project',
    status: 'ACTIVE',
    organizationId: 'org1',
    myRole: 'OWNER',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const view = () =>
  renderRoute(<ProjectSettingsPage />, {
    path: '/projects/:projectId/settings',
    initialEntry: '/projects/p1/settings',
  });

describe('ProjectSettingsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.current = makeAuth(
      makeUser({ orgRole: 'MEMBER', role: { id: 'MEMBER', name: 'MEMBER' } }),
    );
    api.get.mockResolvedValue({ project: project() });
  });

  it('shows a loader, then the saved values', async () => {
    view();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Name')).toHaveValue('Alpha');
    expect(screen.getByLabelText('Description')).toHaveValue('First project');
  });

  it('shows an error with a working retry', async () => {
    api.get.mockRejectedValueOnce(new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom'));
    view();
    expect(await screen.findByText('Could not load the project')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
  });

  it('shows no-access to someone who cannot update the project', async () => {
    api.get.mockResolvedValue({ project: project({ myRole: 'VIEWER' }) });
    view();
    expect(await screen.findByText('Only project owners can change these settings.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('keeps Save off until something changes, then checks the field and saves', async () => {
    api.patch.mockResolvedValue({ project: project({ name: 'Beta' }) });
    view();
    const name = await screen.findByLabelText('Name');
    const save = screen.getByRole('button', { name: 'Save settings' });
    expect(save).toBeDisabled();

    await userEvent.clear(name);
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();

    await userEvent.type(name, 'Beta');
    await userEvent.click(save);
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/projects/p1', {
        name: 'Beta',
        description: 'First project',
      }),
    );
  });

  it('shows the server error under the fields', async () => {
    api.patch.mockRejectedValue(new ApiClientError(409, 'CONFLICT', 'Name already used'));
    view();
    const name = await screen.findByLabelText('Name');
    await userEvent.type(name, ' 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name already used');
  });
});
```

## Notes

- `renderRoute(element, { path, initialEntry })` supplies a fresh query client and a memory router; unmatched routes render their path, so navigation can be asserted.
- Mock `@/lib/api-client` with `importOriginal` so `ApiClientError` stays real; mock `@/providers/auth-provider` to choose the signed-in role with `makeAuth(makeUser({...}))`.
- `vi.resetAllMocks()` in `beforeEach`, then give the happy-path response; override it per test for errors.
- Adding a project tab changes `ProjectDetailPage.test.tsx` (the tab names and the count): update both assertions.
