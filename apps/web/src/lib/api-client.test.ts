import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClientError, apiClient } from './api-client';

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
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['/api/auth/me', '/api/auth/refresh']);
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

  describe('upload', () => {
    const file = new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });

    it('posts the file to the absolute URL without the API prefix or cookies', async () => {
      const fetchMock = vi.fn().mockResolvedValue(respond(201));
      vi.stubGlobal('fetch', fetchMock);
      await apiClient.upload('http://storage.test/upload?token=t', file, 'application/pdf');
      expect(fetchMock).toHaveBeenCalledWith('http://storage.test/upload?token=t', {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });
    });

    it('turns an error envelope into an ApiClientError', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          respond(413, {
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request is too large' },
          }),
        ),
      );
      await expect(apiClient.upload('http://s/u', file, 'application/pdf')).rejects.toMatchObject({
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
      });
    });

    it('reports a friendly message when the network fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      await expect(apiClient.upload('http://s/u', file, 'application/pdf')).rejects.toThrow(
        /Check your connection/,
      );
    });
  });
});
