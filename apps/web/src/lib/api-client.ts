import type { ZodType } from 'zod';
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
let sessionExpiredHandler: (() => void) | null = null;

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

/**
 * Registers what to do when the session is lost for good (for example, clear cached data).
 * It runs just before the redirect to login. Returns a function that removes the handler.
 */
export function onSessionExpired(handler: () => void): () => void {
  sessionExpiredHandler = handler;
  return () => {
    if (sessionExpiredHandler === handler) sessionExpiredHandler = null;
  };
}

// Reloading while already on the login page would restart the session check and loop forever.
function endSession(): void {
  if (window.location.pathname === LOGIN_PATH) return;
  sessionExpiredHandler?.();
  window.location.href = loginUrl(`${window.location.pathname}${window.location.search}`);
}

const REFRESH_RETRY_DELAY_MS = 250;
const NETWORK_ERROR_MESSAGE = 'Cannot reach the server. Check your connection and try again.';

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, withCsrf(init));
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new ApiClientError(0, 'SERVICE_UNAVAILABLE', NETWORK_ERROR_MESSAGE);
  }
}

async function toApiError(res: Response): Promise<ApiClientError> {
  const body = (await res.json().catch(() => null)) as ApiErrorEnvelope | null;
  return new ApiClientError(
    res.status,
    body?.error?.code ?? 'INTERNAL_SERVER_ERROR',
    body?.error?.message ?? 'An unexpected error occurred',
    body?.error?.requestId,
  );
}

async function readBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiClientError(
      res.status,
      'INTERNAL_SERVER_ERROR',
      'The server sent a response that could not be read.',
    );
  }
}

const SESSION_REFUSED = new Set([401, 403]);

// A second tab refreshing at the same instant is refused once; by the retry its new cookie is set.
async function silentRefresh(): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await send(`${BASE_URL}/auth/refresh`, { method: 'POST' });
    if (res.ok) return;
    if (!SESSION_REFUSED.has(res.status)) throw await toApiError(res);
    if (attempt === 1 || res.status !== 401) {
      throw new ApiClientError(res.status, 'UNAUTHORIZED', 'Session expired');
    }
    await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAY_MS));
  }
}

/**
 * Resolves true when the session was renewed and false when the server refused it. A network or
 * server failure while refreshing is not a sign-out, so it is thrown for the caller to show.
 */
async function refreshSession(): Promise<boolean> {
  refreshPromise ??= silentRefresh().finally(() => {
    refreshPromise = null;
  });
  try {
    await refreshPromise;
    return true;
  } catch (err) {
    if (err instanceof ApiClientError && SESSION_REFUSED.has(err.status)) return false;
    throw err;
  }
}

export interface RequestOptions<T = unknown> extends RequestInit {
  /** Shared Zod schema the response must match. Mismatches throw in development. */
  schema?: ZodType<T>;
}

function checkShape<T>(data: T, schema: ZodType<T> | undefined, path: string): T {
  if (!schema) return data;
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  // Issue paths only: values may contain user data.
  const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
  if (import.meta.env.DEV) {
    throw new ApiClientError(
      500,
      'INTERNAL_SERVER_ERROR',
      `Response from ${path} did not match its schema (${fields}).`,
    );
  }
  console.error(`Response from ${path} did not match its schema (${fields}).`);
  return data;
}

async function request<T>(path: string, options: RequestOptions<T>): Promise<T> {
  const { schema, ...init } = options;
  const url = `${BASE_URL}${path}`;
  const res = await send(url, init);

  if (res.ok) return checkShape(await readBody<T>(res), schema, path);

  if (res.status === 401 && !path.startsWith('/auth/refresh')) {
    if (!(await refreshSession())) {
      endSession();
      throw new ApiClientError(401, 'UNAUTHORIZED', 'Session expired');
    }
    const retry = await send(url, init);
    if (retry.ok) return checkShape(await readBody<T>(retry), schema, path);
    // Only a second 401 means the session is gone; a 403 or 500 here is an ordinary failure.
    if (retry.status === 401) endSession();
    throw await toApiError(retry);
  }

  throw await toApiError(res);
}

function withBody(method: string) {
  return <T>(path: string, body?: unknown, opts?: RequestOptions<T>): Promise<T> =>
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
  get: <T>(path: string, opts?: RequestOptions<T>) => request<T>(path, { ...opts, method: 'GET' }),
  post: withBody('POST'),
  put: withBody('PUT'),
  patch: withBody('PATCH'),
  del: <T>(path: string, opts?: RequestOptions<T>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};
