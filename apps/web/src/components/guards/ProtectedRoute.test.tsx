import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { makeAuth, makeUser } from '@/test/render';

const auth = vi.hoisted(() => ({ current: {} as ReturnType<typeof makeAuth> }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth.current }));

import { ProtectedRoute } from './ProtectedRoute';

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>private home</div>} />
          <Route path="/change-password" element={<div>change password page</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('sends signed-out visitors to the login page', () => {
    auth.current = makeAuth(null);
    renderAt('/');
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('renders the page for a signed-in user', () => {
    auth.current = makeAuth(makeUser());
    renderAt('/');
    expect(screen.getByText('private home')).toBeInTheDocument();
  });

  it('forces users on a temporary password to the change-password page', () => {
    auth.current = makeAuth(makeUser({ mustChangePassword: true }));
    renderAt('/');
    expect(screen.getByText('change password page')).toBeInTheDocument();
    expect(screen.queryByText('private home')).not.toBeInTheDocument();
  });

  it('shows a loader, not the page, while the session loads', () => {
    auth.current = { ...makeAuth(null), isLoading: true };
    renderAt('/');
    expect(screen.queryByText('private home')).not.toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });
});
