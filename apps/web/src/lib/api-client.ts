import type { ApiErrorCode, ApiErrorEnvelope } from '@brd/shared';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiClientError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly requestId?: string;

  constructor(status: number, code: ApiErrorCode, message: string, requestId?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

let refreshPromise: Promise<void> | null = null;

async function silentRefresh(): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new ApiClientError(res.status, 'UNAUTHORIZED', 'Session expired');
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { ...init, credentials: 'include' });

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  // On 401, try silent refresh once (unless this IS the refresh call)
  if (res.status === 401 && !path.startsWith('/auth/refresh')) {
    try {
      if (!refreshPromise) {
        refreshPromise = silentRefresh();
      }
      await refreshPromise;
      refreshPromise = null;

      // Retry original request
      const retry = await fetch(url, { ...init, credentials: 'include' });
      if (retry.ok) {
        if (retry.status === 204) return undefined as T;
        return retry.json() as Promise<T>;
      }
      // Retry also failed — fall through to error handling
      const retryBody = (await retry.json().catch(() => null)) as ApiErrorEnvelope | null;
      throw new ApiClientError(
        retry.status,
        retryBody?.error?.code ?? 'UNAUTHORIZED',
        retryBody?.error?.message ?? 'Unauthorized',
        retryBody?.error?.requestId,
      );
    } catch (err) {
      refreshPromise = null;
      if (err instanceof ApiClientError) {
        // Redirect to login on auth failure
        window.location.href = '/login';
        throw err;
      }
      window.location.href = '/login';
      throw new ApiClientError(401, 'UNAUTHORIZED', 'Session expired');
    }
  }

  // Parse error body
  const body = (await res.json().catch(() => null)) as ApiErrorEnvelope | null;
  throw new ApiClientError(
    res.status,
    body?.error?.code ?? 'INTERNAL_SERVER_ERROR',
    body?.error?.message ?? 'An unexpected error occurred',
    body?.error?.requestId,
  );
}

function withBody(method: string) {
  return <T>(path: string, body?: unknown, opts?: RequestInit): Promise<T> =>
    request<T>(path, {
      ...opts,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...opts?.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestInit) => request<T>(path, { ...opts, method: 'GET' }),
  post: withBody('POST'),
  put: withBody('PUT'),
  patch: withBody('PATCH'),
  del: <T>(path: string, opts?: RequestInit) => request<T>(path, { ...opts, method: 'DELETE' }),
};
