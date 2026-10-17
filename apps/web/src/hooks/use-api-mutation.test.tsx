import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@brd/ui';
import { ApiClientError } from '@/lib/api-client';
import { useApiMutation } from './use-api-mutation';

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}

const KEY = ['projects'] as const;

describe('useApiMutation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('refreshes the listed queries and shows the success message', async () => {
    const success = vi.spyOn(toast, 'success').mockReturnValue('');
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn: () => Promise.resolve('done'),
          invalidate: [KEY],
          successMessage: 'Saved',
        }),
      { wrapper },
    );

    await act(() => result.current.mutateAsync());

    expect(success).toHaveBeenCalledWith('Saved');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: KEY });
  });

  it('shows the failure as a toast and leaves queries alone', async () => {
    const error = vi.spyOn(toast, 'error').mockReturnValue('');
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn: () => Promise.reject(new ApiClientError(409, 'CONFLICT', 'Already exists')),
          invalidate: [KEY],
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    expect(error).toHaveBeenCalledWith('Already exists');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('stays quiet when the caller shows the error itself', async () => {
    const error = vi.spyOn(toast, 'error').mockReturnValue('');
    const { wrapper } = setup();
    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn: () => Promise.reject(new ApiClientError(400, 'BAD_REQUEST', 'Nope')),
          errorToast: false,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(error).not.toHaveBeenCalled();
  });

  it('can refresh after a failure too', async () => {
    vi.spyOn(toast, 'error').mockReturnValue('');
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn: () => Promise.reject(new ApiClientError(500, 'INTERNAL_SERVER_ERROR', 'Boom')),
          invalidate: [KEY],
          invalidateOn: 'settled',
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: KEY });
  });
});
