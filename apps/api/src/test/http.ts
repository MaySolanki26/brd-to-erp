import request from 'supertest';
import type { Express } from 'express';
import { TEST_ORIGIN } from './test-env.js';

export interface Session {
  cookies: Record<string, string>;
}

export function parseSetCookies(res: request.Response): Record<string, string> {
  const jar: Record<string, string> = {};
  const header = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  const lines = Array.isArray(header) ? header : header ? [header] : [];
  for (const line of lines) {
    const [pair] = line.split(';');
    const idx = pair?.indexOf('=') ?? -1;
    if (pair && idx > 0) {
      jar[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
  }
  return jar;
}

export function cookieHeader(session: Session): string {
  return Object.entries(session.cookies)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export async function login(app: Express, email: string, password: string): Promise<Session> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed with ${res.status}`);
  }
  return { cookies: parseSetCookies(res) };
}

type Method = 'get' | 'post' | 'patch' | 'delete';

/** Sends a request as a logged-in browser would: cookies, origin and CSRF header. */
export function as(app: Express, session: Session, method: Method, path: string): request.Test {
  return request(app)
    [method](path)
    .set('Cookie', cookieHeader(session))
    .set('Origin', TEST_ORIGIN)
    .set('X-CSRF-Token', session.cookies['csrf_token'] ?? '');
}
