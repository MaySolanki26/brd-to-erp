import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { makeAuth, makeUser } from '@/test/render';

const auth = vi.hoisted(() => ({ current: {} as ReturnType<typeof makeAuth> }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth.current }));

import { AuthLayout } from './AuthLayout';

function view(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<p>Login form</p>} />
        </Route>
        <Route path="/" element={<p>Home</p>} />
        <Route path="/projects" element={<p>Projects</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthLayout', () => {
  it('shows the sign-in page to a signed-out visitor', () => {
    auth.current = makeAuth(null);
    view('/login');
    expect(screen.getByText('Login form')).toBeInTheDocument();
  });

  it('sends a signed-in user to the page they were heading for', () => {
    auth.current = makeAuth(makeUser());
    view('/login?returnTo=%2Fprojects');
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('ignores an unsafe return address', () => {
    auth.current = makeAuth(makeUser());
    view('/login?returnTo=https%3A%2F%2Fevil.example');
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});
