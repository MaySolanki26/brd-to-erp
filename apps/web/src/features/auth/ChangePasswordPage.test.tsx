import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import { ChangePasswordPage } from './ChangePasswordPage';

const TEMP = 'Temp-Passw0rd-123';
const NEXT = 'My-Own-Passw0rd-456';

async function fill(current: string, next: string, confirm: string) {
  await userEvent.type(screen.getByLabelText(/temporary password|current password/i), current);
  await userEvent.type(screen.getByLabelText('New password'), next);
  await userEvent.type(screen.getByLabelText('Confirm new password'), confirm);
  await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    auth.current = makeAuth(makeUser({ mustChangePassword: true }));
  });

  it('explains the forced change and hides cancel', () => {
    renderRoute(<ChangePasswordPage />, { path: '/change-password' });
    expect(screen.getByText('Choose a new password')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('offers cancel when the change is voluntary', () => {
    auth.current = makeAuth(makeUser());
    renderRoute(<ChangePasswordPage />, { path: '/change-password' });
    expect(screen.getByText('Change password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('rejects mismatched confirmation without calling the API', async () => {
    renderRoute(<ChangePasswordPage />, { path: '/change-password' });
    await fill(TEMP, NEXT, 'something-else-entirely');
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('enforces the minimum length', async () => {
    renderRoute(<ChangePasswordPage />, { path: '/change-password' });
    await fill(TEMP, 'short', 'short');
    expect(
      await screen.findByText(/at least 12 characters/i, {
        selector: '[id$="-form-item-message"]',
      }),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects reusing the temporary password', async () => {
    renderRoute(<ChangePasswordPage />, { path: '/change-password' });
    await fill(TEMP, TEMP, TEMP);
    expect(
      await screen.findByText('New password must be different from the current one'),
    ).toBeInTheDocument();
  });

  it('sends only the current and new password, then goes home', async () => {
    api.post.mockResolvedValue({ user: makeUser({ mustChangePassword: false }) });
    renderRoute(<ChangePasswordPage />, { path: '/change-password' });
    await fill(TEMP, NEXT, NEXT);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: TEMP,
        newPassword: NEXT,
      }),
    );
    expect(await screen.findByTestId('location')).toHaveTextContent('/');
  });

  it('shows the server error when the current password is wrong', async () => {
    api.post.mockRejectedValue(
      new ApiClientError(400, 'VALIDATION_ERROR', 'Current password is incorrect'),
    );
    renderRoute(<ChangePasswordPage />, { path: '/change-password' });
    await fill('wrong-current-pw', NEXT, NEXT);
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');
  });
});
