import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberCandidateDto, MemberDto } from '@brd/shared';
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
import { AddMemberDrawer } from './AddMemberDrawer';

const CAL = '00000000-0000-4000-8000-0000000000c1';
const DANA = '00000000-0000-4000-8000-0000000000c2';
const CANDIDATES: MemberCandidateDto[] = [
  { userId: CAL, name: 'Cal Carter', email: 'cal@brd.test' },
  { userId: DANA, name: 'Dana Diaz', email: 'dana.diaz@example.org' },
];

function view(onOpenChange = vi.fn()) {
  renderRoute(<AddMemberDrawer projectId="p1" open onOpenChange={onOpenChange} />);
  return { onOpenChange };
}

const picker = () => screen.findByRole('button', { name: /^Person:/ });

describe('AddMemberDrawer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.get.mockResolvedValue({ candidates: CANDIDATES });
  });

  it('finds a person by typing part of their email address', async () => {
    view();
    await userEvent.click(await picker());
    await userEvent.type(screen.getByRole('textbox', { name: 'Search Person' }), 'example.org');
    expect(screen.getByText('Dana Diaz (dana.diaz@example.org)')).toBeInTheDocument();
    expect(screen.queryByText('Cal Carter (cal@brd.test)')).not.toBeInTheDocument();
  });

  it('finds a person by name and says so when nobody matches', async () => {
    view();
    await userEvent.click(await picker());
    const search = screen.getByRole('textbox', { name: 'Search Person' });
    await userEvent.type(search, 'cal');
    expect(screen.getByText('Cal Carter (cal@brd.test)')).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'nobody@nowhere');
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('adds the chosen person with the chosen role', async () => {
    const member: MemberDto = {
      userId: DANA,
      name: 'Dana Diaz',
      email: 'dana.diaz@example.org',
      role: 'ANALYST',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    api.post.mockResolvedValue({ member });
    const { onOpenChange } = view();
    await userEvent.click(await picker());
    await userEvent.click(screen.getByText('Dana Diaz (dana.diaz@example.org)'));
    expect(
      screen.getByRole('button', { name: 'Person: Dana Diaz (dana.diaz@example.org)' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add member' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/projects/p1/members', {
        userId: DANA,
        role: 'ANALYST',
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('asks for a person before saving', async () => {
    view();
    await picker();
    await userEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('Invalid id')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the server error under the fields', async () => {
    api.post.mockRejectedValue(
      new ApiClientError(409, 'CONFLICT', 'User is already a member of this project'),
    );
    view();
    await userEvent.click(await picker());
    await userEvent.click(screen.getByText('Cal Carter (cal@brd.test)'));
    await userEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'User is already a member of this project',
    );
  });

  it('explains when everyone is already on the project and blocks saving', async () => {
    api.get.mockResolvedValue({ candidates: [] });
    view();
    expect(await screen.findByText(/already on this project/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Person:/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add member' })).toBeDisabled();
  });

  it('shows why the list could not load', async () => {
    api.get.mockRejectedValue(new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'boom'));
    view();
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});
