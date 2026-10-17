import { QueryClient } from '@tanstack/react-query';
import { ApiClientError, onSessionExpired } from '@/lib/api-client';

/** How long fetched data counts as fresh. Use `live` together with polling. */
export const STALE = {
  reference: 10 * 60_000,
  standard: 30_000,
  live: 0,
} as const;

const MAX_RETRIES = 1;

/** Retry only failures that can pass on their own: no connection, or a server error. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  return error instanceof ApiClientError && (error.status === 0 || error.status >= 500);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.standard,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// When the session is lost, drop cached data so the next sign-in on this browser starts clean.
onSessionExpired(() => queryClient.clear());
