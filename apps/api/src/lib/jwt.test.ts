import { describe, it, expect, vi } from 'vitest';
import { SignJWT } from 'jose';

vi.mock('../config/env.js', async () => (await import('../test/test-env.js')).envModule);

import { envModule } from '../test/test-env.js';
import { signAccessToken, verifyAccessToken } from './jwt.js';

const payload = {
  userId: '11111111-1111-4111-8111-111111111111',
  familyId: '33333333-3333-4333-8333-333333333333',
  organizationId: '22222222-2222-4222-8222-222222222222',
  orgRole: 'ORG_ADMIN',
} as const;

async function signRaw(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(envModule.env.JWT_ACCESS_SECRET));
}

describe('access token', () => {
  it('round-trips the payload', async () => {
    const token = await signAccessToken(payload);
    expect(await verifyAccessToken(token)).toMatchObject(payload);
  });

  it('rejects a correctly signed token whose payload is missing the user id', async () => {
    const token = await signRaw({ organizationId: payload.organizationId, orgRole: 'MEMBER' });
    await expect(verifyAccessToken(token)).rejects.toThrow('Invalid access token');
  });

  it('rejects a correctly signed token with a non-uuid user id or an unknown role', async () => {
    await expect(verifyAccessToken(await signRaw({ ...payload, userId: 'u1' }))).rejects.toThrow(
      'Invalid access token',
    );
    await expect(
      verifyAccessToken(await signRaw({ ...payload, orgRole: 'SUPERUSER' })),
    ).rejects.toThrow('Invalid access token');
  });

  it('rejects a correctly signed token that is not tied to a session family', async () => {
    const withoutFamily: Record<string, unknown> = { ...payload };
    delete withoutFamily['familyId'];
    await expect(verifyAccessToken(await signRaw(withoutFamily))).rejects.toThrow(
      'Invalid access token',
    );
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
