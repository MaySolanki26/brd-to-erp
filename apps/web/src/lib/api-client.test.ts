import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClientError, apiClient } from './api-client';

function respond(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status });
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
});
