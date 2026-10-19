import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OrgUserDto } from '@brd/shared';
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
import { TeamPage } from './TeamPage';

function orgUser(overrides: Partial<OrgUserDto>): OrgUserDto {
  return {
    id: 'u1',
    email: 'u1@brd.test',
    name: 'User One',
    orgRole: 'MEMBER',
    active: true,
    mustChangePassword: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const ME = orgUser({ id: 'me', name: 'Me Admin', email: 'me@brd.test', orgRole: 'ORG_ADMIN' });
const ALICE = orgUser({ id: 'alice', name: 'Alice', email: 'alice@brd.test' });

describe('TeamPage', () => {
  beforeEach(() => {
    auth.current = makeAuth(makeUser());
  });

  it('shows a loading state before the team arrives', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderRoute(<TeamPage />);
    expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error with a working retry', async () => {
    api.get.mockRejectedValueOnce(new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom'));
    renderRoute(<TeamPage />);
    expect(await screen.findByText('Could not load the team')).toBeInTheDocument();

    api.get.mockResolvedValueOnce({ users: [ME] });
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Me Admin')).toBeInTheDocument();
  });

  it('shows no-access when the API refuses the request', async () => {
    api.get.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'nope'));
    renderRoute(<TeamPage />);
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });

  it('shows an empty state with an add action', async () => {
    api.get.mockResolvedValue({ users: [] });
    renderRoute(<TeamPage />);
    expect(await screen.findByText('No team members yet')).toBeInTheDocument();
  });

  it('lists members and blocks self-service actions on your own row', async () => {
    api.get.mockResolvedValue({ users: [ME, ALICE] });
    renderRoute(<TeamPage />);
    expect(await screen.findByText('Alice')).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    const mine = rows.find((row) => within(row).queryByText('(you)'));
    const hers = rows.find((row) => within(row).queryByText('Alice'));
    expect(mine && within(mine).queryByRole('button', { name: 'More actions' })).toBeNull();
    expect(hers).toBeDefined();
    await userEvent.click(
      within(hers as HTMLElement).getByRole('button', { name: 'More actions' }),
    );
    expect(await screen.findByRole('menuitem', { name: 'Deactivate' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Reset password' })).toBeInTheDocument();
  });

  it('flags users who have not changed their temporary password', async () => {
    api.get.mockResolvedValue({
      users: [ME, orgUser({ id: 'n', name: 'Newbie', mustChangePassword: true })],
    });
    renderRoute(<TeamPage />);
    expect(await screen.findByText('Pending password change')).toBeInTheDocument();
  });

  it('deactivates a user only after confirmation', async () => {
    api.get.mockResolvedValue({ users: [ME, ALICE] });
    api.patch.mockResolvedValue({ user: { ...ALICE, active: false } });
    renderRoute(<TeamPage />);
    await screen.findByText('Alice');

    const alice = screen
      .getAllByRole('row')
      .find((row) => within(row).queryByText('Alice')) as HTMLElement;
    await userEvent.click(within(alice).getByRole('button', { name: 'More actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Deactivate' }));
    expect(api.patch).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/users/alice', { active: false }));
  });

  it('creates a member with a generated temporary password and shows it once', async () => {
    api.get.mockResolvedValue({ users: [ME] });
    api.post.mockResolvedValue({
      user: orgUser({
        id: 'new',
        name: 'New Person',
        email: 'new@brd.test',
        mustChangePassword: true,
      }),
    });
    renderRoute(<TeamPage />);
    await screen.findByText('Me Admin');

    await userEvent.click(screen.getByRole('button', { name: /add member/i }));
    const password = (await screen.findByLabelText('Temporary password')) as HTMLInputElement;
    expect(password.value.length).toBeGreaterThanOrEqual(12);

    await userEvent.type(screen.getByLabelText('Name'), 'New Person');
    await userEvent.type(screen.getByLabelText('Email'), 'New@BRD.test');
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/users', {
      email: 'new@brd.test',
      name: 'New Person',
      orgRole: 'MEMBER',
      tempPassword: password.value,
    });
    expect(await screen.findByText('Share these sign-in details')).toBeInTheDocument();
  });

  it('validates the form before calling the API', async () => {
    api.get.mockResolvedValue({ users: [ME] });
    renderRoute(<TeamPage />);
    await screen.findByText('Me Admin');

    await userEvent.click(screen.getByRole('button', { name: /add member/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Create user' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
