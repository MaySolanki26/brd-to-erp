import { ApiClientError } from '@/lib/api-client';

export function errorMessage(err: unknown): string {
  return err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.';
}

export function isForbidden(err: unknown): boolean {
  return err instanceof ApiClientError && err.status === 403;
}
