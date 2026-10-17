import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/app-error.js';

const accessTokenPayloadSchema = z.object({
  userId: z.string().uuid(),
  /** Refresh-token family the token was issued under; revoking the family ends the access token. */
  familyId: z.string().uuid(),
  organizationId: z.string().uuid(),
  orgRole: z.enum(['ORG_ADMIN', 'MEMBER']),
});

export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_EXPIRY_SECONDS}s`)
    .sign(encodeSecret(env.JWT_ACCESS_SECRET));
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(env.JWT_ACCESS_SECRET), {
      algorithms: ['HS256'],
    });
    return accessTokenPayloadSchema.parse(payload);
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new UnauthorizedError('Access token has expired');
    }
    throw new UnauthorizedError('Invalid access token');
  }
}
