import type { ApiErrorCode, ApiErrorEnvelope } from '@brd/shared';

const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`;

/** Builds a URL for a browser-handled request (such as a download link) to the API. */
export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

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

const LOGIN_PATH = '/login';
const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'X-CSRF-Token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function readCsrfToken(): string | undefined {
  for (const pair of document.cookie.split(';')) {
    const [name, ...rest] = pair.trim().split('=');
    if (name === CSRF_COOKIE) return rest.join('=');
  }
  return undefined;
}

// Read per attempt: a token refresh rotates the csrf cookie.
function withCsrf(init: RequestInit): RequestInit {
  const method = (init.method ?? 'GET').toUpperCase();
  const token = readCsrfToken();
  if (SAFE_METHODS.has(method) || !token) return { ...init, credentials: 'include' };
  const headers = new Headers(init.headers);
  headers.set(CSRF_HEADER, token);
  return { ...init, headers, credentials: 'include' };
}

// Reloading while already on the login page would restart the session check and loop forever.
function redirectToLogin(): void {
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.href = LOGIN_PATH;
  }
}

async function silentRefresh(): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, withCsrf({ method: 'POST' }));
  if (!res.ok) {
    throw new ApiClientError(res.status, 'UNAUTHORIZED', 'Session expired');
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, withCsrf(init));

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
      const retry = await fetch(url, withCsrf(init));
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
      redirectToLogin();
      if (err instanceof ApiClientError) {
        throw err;
      }
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

/**
 * Sends a file straight to a signed storage URL. The URL is absolute and carries its own token,
 * so this skips the /api prefix and never sends the session cookie.
 */
async function upload(url: string, file: File, contentType: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: file,
    });
  } catch {
    throw new ApiClientError(
      0,
      'INTERNAL_SERVER_ERROR',
      'Upload failed. Check your connection and try again.',
    );
  }
  if (res.ok) return;

  const body = (await res.json().catch(() => null)) as ApiErrorEnvelope | null;
  throw new ApiClientError(
    res.status,
    body?.error?.code ?? 'INTERNAL_SERVER_ERROR',
    body?.error?.message ?? 'Upload failed. Please try again.',
    body?.error?.requestId,
  );
}

export const apiClient = {
  upload,
  get: <T>(path: string, opts?: RequestInit) => request<T>(path, { ...opts, method: 'GET' }),
  post: withBody('POST'),
  put: withBody('PUT'),
  patch: withBody('PATCH'),
  del: <T>(path: string, opts?: RequestInit) => request<T>(path, { ...opts, method: 'DELETE' }),
};
