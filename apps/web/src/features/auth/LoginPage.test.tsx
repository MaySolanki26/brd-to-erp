import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeUser, renderRoute } from '@/test/render';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiClient: api,
}));

import { ApiClientError } from '@/lib/api-client';
import { LoginPage } from './LoginPage';

async function signIn(initialEntry: string) {
  renderRoute(<LoginPage />, { path: '/login', initialEntry });
  await userEvent.type(screen.getByLabelText('Email'), 'alice@brd.local');
  await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!dev');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginPage', () => {
  it('returns to the page the user was sent away from', async () => {
    api.post.mockResolvedValue({ user: makeUser() });
    await signIn('/login?returnTo=%2Fprojects%2Fp1');
    expect(await screen.findByTestId('location')).toHaveTextContent('/projects/p1');
  });

  it('ignores a return URL that points off-site', async () => {
    api.post.mockResolvedValue({ user: makeUser() });
    await signIn('/login?returnTo=https%3A%2F%2Fevil.example');
    expect(await screen.findByTestId('location')).toHaveTextContent('/');
  });

  it('goes home without a return URL', async () => {
    api.post.mockResolvedValue({ user: makeUser() });
    await signIn('/login');
    expect(await screen.findByTestId('location')).toHaveTextContent('/');
  });

  it('shows the server error for wrong credentials and stays on the page', async () => {
    api.post.mockRejectedValue(
      new ApiClientError(401, 'UNAUTHORIZED', 'Invalid email or password'),
    );
    await signIn('/login');
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
});
