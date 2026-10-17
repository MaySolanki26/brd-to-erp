import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { makeAuth, makeUser } from '@/test/render';

const auth = vi.hoisted(() => ({ current: {} as ReturnType<typeof makeAuth> }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth.current }));

import { ProtectedRoute } from './ProtectedRoute';

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{`${pathname}${search}`}</div>;
}

function view(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/projects/:id" element={<div>Secret page</div>} />
          <Route path="/change-password" element={<div>Change password</div>} />
        </Route>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('shows the page to a signed-in user', () => {
    auth.current = makeAuth(makeUser());
    view('/projects/p1');
    expect(screen.getByText('Secret page')).toBeInTheDocument();
  });

  it('sends a signed-out visitor to login and remembers where they were going', () => {
    auth.current = makeAuth(null);
    view('/projects/p1?tab=members');
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/login?returnTo=%2Fprojects%2Fp1%3Ftab%3Dmembers',
    );
  });

  it('shows a loader while the session is being checked', () => {
    auth.current = { ...makeAuth(null), isLoading: true };
    view('/projects/p1');
    expect(screen.queryByText('Secret page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('shows an error with retry, not the login page, when the session check fails', async () => {
    const retry = vi.fn();
    auth.current = { ...makeAuth(null), isError: true, retry };
    view('/projects/p1');
    expect(screen.getByText('Could not check your session')).toBeInTheDocument();
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry|try again/i }));
    expect(retry).toHaveBeenCalled();
  });

  it('forces a password change before anything else', () => {
    auth.current = makeAuth(makeUser({ mustChangePassword: true }));
    view('/projects/p1');
    expect(screen.getByText('Change password')).toBeInTheDocument();
  });
});
