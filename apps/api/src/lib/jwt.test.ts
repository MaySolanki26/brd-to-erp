import { describe, it, expect, vi } from 'vitest';
import { SignJWT } from 'jose';

vi.mock('../config/env.js', async () => (await import('../test/test-env.js')).envModule);

import { signAccessToken, verifyAccessToken } from './jwt.js';

const payload = { userId: 'u1', organizationId: 'o1', orgRole: 'ORG_ADMIN' } as const;

describe('access token', () => {
  it('round-trips the payload', async () => {
    const token = await signAccessToken(payload);
    expect(await verifyAccessToken(token)).toMatchObject(payload);
  });

  it('rejects a garbage token', async () => {
    await expect(verifyAccessToken('garbage')).rejects.toThrow('Invalid access token');
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('some-other-secret-value'));
    await expect(verifyAccessToken(forged)).rejects.toThrow('Invalid access token');
  });

  it('rejects an unsigned (alg none) token', async () => {
    const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
    const body = Buffer.from(JSON.stringify({ ...payload, exp: 9999999999 })).toString('base64url');
    await expect(verifyAccessToken(`${header}.${body}.`)).rejects.toThrow('Invalid access token');
  });

  it('reports expiry distinctly', async () => {
    const expired = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(new TextEncoder().encode('test-access-secret-min-16'));
    await expect(verifyAccessToken(expired)).rejects.toThrow('expired');
  });
});
