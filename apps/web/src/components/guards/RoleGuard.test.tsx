import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { makeAuth, makeUser } from '@/test/render';

const auth = vi.hoisted(() => ({ current: {} as ReturnType<typeof makeAuth> }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth.current }));

import { RoleGuard } from './RoleGuard';

function view() {
  return render(
    <MemoryRouter initialEntries={['/team']}>
      <Routes>
        <Route element={<RoleGuard roles={['ORG_ADMIN']} />}>
          <Route path="/team" element={<p>Team page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleGuard', () => {
  it('lets an allowed role through', () => {
    auth.current = makeAuth(makeUser());
    view();
    expect(screen.getByText('Team page')).toBeInTheDocument();
  });

  it('shows the no-access page to other roles and keeps the address', () => {
    auth.current = makeAuth(makeUser({ orgRole: 'MEMBER', role: { id: 'MEMBER', name: 'MEMBER' } }));
    view();
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByText('Team page')).not.toBeInTheDocument();
  });
});
