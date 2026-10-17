import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { ApiClientError, apiClient, onSessionExpired } from './api-client';

function respond(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status });
}

function headersOfCall(fetchMock: ReturnType<typeof vi.fn>, index: number): Headers {
  const call = fetchMock.mock.calls[index] as [string, RequestInit | undefined] | undefined;
  return new Headers(call?.[1]?.headers);
}

describe('apiClient', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('prefixes every path with /api and sends cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await apiClient.get('/auth/me');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    );
  });

  it('surfaces the error envelope as an ApiClientError', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          respond(409, { error: { code: 'CONFLICT', message: 'Already exists', requestId: 'r1' } }),
        ),
    );
    await expect(apiClient.post('/users', {})).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Already exists',
    });
  });

  it('does not reload the login page when the session check fails', async () => {
    window.history.pushState({}, '', '/login');
    const fetchMock = vi.fn().mockResolvedValue(respond(401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.get('/auth/me')).rejects.toBeInstanceOf(ApiClientError);

    expect(window.location.pathname).toBe('/login');
    // One retry of the refresh covers a second tab refreshing at the same moment.
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/auth/me',
      '/api/auth/refresh',
      '/api/auth/refresh',
    ]);
  });

  it('retries a refused refresh once and carries on when the second attempt succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(401))
      .mockResolvedValueOnce(respond(401))
      .mockResolvedValueOnce(respond(200, {}))
      .mockResolvedValueOnce(respond(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.get('/projects')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/projects',
      '/api/auth/refresh',
      '/api/auth/refresh',
      '/api/projects',
    ]);
  });

  it('sends an expired session to login with the page it was on as the return URL', async () => {
    const original = window.location;
    const location = { pathname: '/projects/p1', search: '?tab=members', href: '' };
    Object.defineProperty(window, 'location', { value: location, writable: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(401)));

    try {
      await expect(apiClient.get('/projects/p1')).rejects.toBeInstanceOf(ApiClientError);
      expect(location.href).toBe('/login?returnTo=%2Fprojects%2Fp1%3Ftab%3Dmembers');
    } finally {
      Object.defineProperty(window, 'location', { value: original, writable: true });
    }
  });

  describe('session loss and failures', () => {
    function withFakeLocation() {
      const original = window.location;
      const location = { pathname: '/projects', search: '', href: '' };
      Object.defineProperty(window, 'location', { value: location, writable: true });
      return {
        location,
        restore: () => Object.defineProperty(window, 'location', { value: original, writable: true }),
      };
    }

    it('keeps the user signed in when the retry after a refresh fails for another reason', async () => {
      const fake = withFakeLocation();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(respond(401))
        .mockResolvedValueOnce(respond(200, {}))
        .mockResolvedValueOnce(
          respond(403, { error: { code: 'FORBIDDEN', message: 'No access', requestId: 'r2' } }),
        );
      vi.stubGlobal('fetch', fetchMock);
      try {
        await expect(apiClient.get('/projects/p1')).rejects.toMatchObject({
          status: 403,
          code: 'FORBIDDEN',
        });
        expect(fake.location.href).toBe('');
      } finally {
        fake.restore();
      }
    });

    it('signs out when the retry is still unauthorized', async () => {
      const fake = withFakeLocation();
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(respond(401))
          .mockResolvedValueOnce(respond(200, {}))
          .mockResolvedValueOnce(respond(401)),
      );
      try {
        await expect(apiClient.get('/projects')).rejects.toMatchObject({ status: 401 });
        expect(fake.location.href).toBe('/login?returnTo=%2Fprojects');
      } finally {
        fake.restore();
      }
    });

    it('runs the session-expired handler before redirecting', async () => {
      const fake = withFakeLocation();
      const handler = vi.fn();
      const remove = onSessionExpired(handler);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(401)));
      try {
        await expect(apiClient.get('/projects')).rejects.toBeInstanceOf(ApiClientError);
        expect(handler).toHaveBeenCalledTimes(1);
      } finally {
        remove();
        fake.restore();
      }
    });

    it('does not sign out when the server fails while refreshing', async () => {
      const fake = withFakeLocation();
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(respond(401))
          .mockResolvedValueOnce(
            respond(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Down' } }),
          ),
      );
      try {
        await expect(apiClient.get('/projects')).rejects.toMatchObject({ status: 503 });
        expect(fake.location.href).toBe('');
      } finally {
        fake.restore();
      }
    });

    it('turns a network failure into a typed error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      await expect(apiClient.get('/projects')).rejects.toMatchObject({
        status: 0,
        code: 'SERVICE_UNAVAILABLE',
      });
    });

    it('rejects an unreadable success response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));
      await expect(apiClient.get('/projects')).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
      });
    });
  });

  describe('response schema', () => {
    const schema = z.object({ id: z.string() });

    it('returns data that matches the schema', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { id: 'a' })));
      await expect(apiClient.get('/x', { schema })).resolves.toEqual({ id: 'a' });
    });

    it('fails loudly in development when the shape is wrong', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { id: 5 })));
      await expect(apiClient.get('/x', { schema })).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: expect.stringContaining('id'),
      });
    });
  });

  describe('CSRF header', () => {
    beforeEach(() => {
      document.cookie = 'csrf_token=tok-1; path=/';
    });

    it('sends the csrf cookie value on mutations', async () => {
      const fetchMock = vi.fn().mockResolvedValue(respond(200, {}));
      vi.stubGlobal('fetch', fetchMock);
      await apiClient.post('/projects', { name: 'x' });
      const headers = headersOfCall(fetchMock, 0);
      expect(headers.get('X-CSRF-Token')).toBe('tok-1');
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('does not send it on GET', async () => {
      const fetchMock = vi.fn().mockResolvedValue(respond(200, {}));
      vi.stubGlobal('fetch', fetchMock);
      await apiClient.get('/projects');
      expect(headersOfCall(fetchMock, 0).has('X-CSRF-Token')).toBe(false);
    });

    it('re-reads the token for the retry after a silent refresh', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(respond(401))
        .mockImplementationOnce(async () => {
          document.cookie = 'csrf_token=tok-2; path=/';
          return respond(200, {});
        })
        .mockResolvedValueOnce(respond(200, {}));
      vi.stubGlobal('fetch', fetchMock);
      await apiClient.del('/projects/1');
      expect(headersOfCall(fetchMock, 2).get('X-CSRF-Token')).toBe('tok-2');
    });
  });
});
