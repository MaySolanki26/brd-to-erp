import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';

vi.mock('../config/env.js', async () => (await import('../test/test-env.js')).envModule);

import { clearAuthCookies, parseCookie, setAuthCookies } from './cookies.js';

function fakeResponse() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response & {
    cookie: ReturnType<typeof vi.fn>;
    clearCookie: ReturnType<typeof vi.fn>;
  };
}

describe('parseCookie', () => {
  it('reads a named cookie among several', () => {
    expect(parseCookie('a=1; access_token=xyz; b=2', 'access_token')).toBe('xyz');
  });

  it('returns undefined when absent or header missing', () => {
    expect(parseCookie('a=1', 'b')).toBeUndefined();
    expect(parseCookie(undefined, 'b')).toBeUndefined();
  });

  it('keeps "=" characters inside the value', () => {
    expect(parseCookie('t=a=b==', 't')).toBe('a=b==');
  });
});

describe('setAuthCookies', () => {
  it('sets httpOnly lax session cookies, with a path-scoped refresh cookie and a readable csrf cookie', () => {
    const res = fakeResponse();
    setAuthCookies(res, { accessToken: 'a', refreshToken: 'r', csrfToken: 'c' });

    const byName = Object.fromEntries(res.cookie.mock.calls.map((c) => [c[0], c[2]]));
    expect(byName['access_token']).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 900_000,
    });
    expect(byName['refresh_token']).toMatchObject({
      httpOnly: true,
      path: '/api/auth',
      maxAge: 604_800_000,
    });
    expect(byName['csrf_token']).toMatchObject({ httpOnly: false, sameSite: 'lax' });
  });

  it('clears all three cookies on the same paths', () => {
    const res = fakeResponse();
    clearAuthCookies(res);
    expect(res.clearCookie.mock.calls.map((c) => c[0])).toEqual([
      'access_token',
      'refresh_token',
      'csrf_token',
    ]);
    expect(res.clearCookie.mock.calls[1]?.[1]).toMatchObject({ path: '/api/auth' });
  });
});
