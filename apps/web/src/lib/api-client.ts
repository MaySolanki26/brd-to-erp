import type { ApiErrorCode, ApiErrorEnvelope } from '@brd/shared';
import { loginUrl } from './return-to';

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
    window.location.href = loginUrl(`${window.location.pathname}${window.location.search}`);
  }
}

const REFRESH_RETRY_DELAY_MS = 250;

// A second tab refreshing at the same instant is refused once; by the retry its new cookie is set.
async function silentRefresh(): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(`${BASE_URL}/auth/refresh`, withCsrf({ method: 'POST' }));
    if (res.ok) return;
    if (attempt === 1 || res.status !== 401) {
      throw new ApiClientError(res.status, 'UNAUTHORIZED', 'Session expired');
    }
    await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAY_MS));
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

export interface UploadOptions {
  /** Called with 0-100 as bytes are sent. */
  onProgress?: (percent: number) => void;
  /** Aborting before the transfer ends cancels it; nothing is stored. */
  signal?: AbortSignal;
}

/** Thrown when an upload is stopped on purpose, so callers can tell it from a failure. */
export class UploadCanceledError extends Error {
  constructor() {
    super('Upload canceled');
    this.name = 'UploadCanceledError';
  }
}

interface RawResponse {
  status: number;
  text: string;
}

// fetch cannot report upload progress, so file transfers use XMLHttpRequest.
function sendFile(
  url: string,
  file: File,
  contentType: string,
  options: UploadOptions,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const { signal } = options;
    if (signal?.aborted) {
      reject(new UploadCanceledError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () =>
      reject(
        new ApiClientError(
          0,
          'INTERNAL_SERVER_ERROR',
          'Upload failed. Check your connection and try again.',
        ),
      );
    xhr.onabort = () => reject(new UploadCanceledError());
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

function parseEnvelope(text: string): ApiErrorEnvelope | null {
  try {
    return JSON.parse(text) as ApiErrorEnvelope;
  } catch {
    return null;
  }
}

/**
 * Sends a file straight to a signed storage URL. The URL is absolute and carries its own token,
 * so this skips the /api prefix and never sends the session cookie.
 */
async function upload(
  url: string,
  file: File,
  contentType: string,
  options: UploadOptions = {},
): Promise<void> {
  const res = await sendFile(url, file, contentType, options);
  if (res.status >= 200 && res.status < 300) return;

  const body = parseEnvelope(res.text);
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
