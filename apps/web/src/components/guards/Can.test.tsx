import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeAuth, makeUser } from '@/test/render';

const auth = vi.hoisted(() => ({ current: {} as ReturnType<typeof makeAuth> }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth.current }));

import { Can } from './Can';

describe('Can', () => {
  it('shows children to an allowed role', () => {
    auth.current = makeAuth(makeUser());
    render(
      <Can roles={['ORG_ADMIN']}>
        <button type="button">Invite</button>
      </Can>,
    );
    expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument();
  });

  it('shows the fallback to everyone else', () => {
    auth.current = makeAuth(makeUser({ orgRole: 'MEMBER', role: { id: 'MEMBER', name: 'MEMBER' } }));
    render(
      <Can roles={['ORG_ADMIN']} fallback={<p>Admins only</p>}>
        <button type="button">Invite</button>
      </Can>,
    );
    expect(screen.queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument();
    expect(screen.getByText('Admins only')).toBeInTheDocument();
  });

  it('checks project permissions against the project role', () => {
    auth.current = makeAuth(makeUser({ orgRole: 'MEMBER', role: { id: 'MEMBER', name: 'MEMBER' } }));
    const { rerender } = render(
      <Can permission="ARCHIVE_PROJECT" projectRole="ANALYST">
        <button type="button">Archive</button>
      </Can>,
    );
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();

    rerender(
      <Can permission="ARCHIVE_PROJECT" projectRole="OWNER">
        <button type="button">Archive</button>
      </Can>,
    );
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
  });

  it('hides everything while nobody is signed in', () => {
    auth.current = makeAuth(null);
    render(
      <Can roles={['ORG_ADMIN', 'MEMBER']}>
        <p>Private</p>
      </Can>,
    );
    expect(screen.queryByText('Private')).not.toBeInTheDocument();
  });
});
