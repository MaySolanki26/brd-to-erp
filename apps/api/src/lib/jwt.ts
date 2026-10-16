import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/app-error.js';

export interface AccessTokenPayload {
  userId: string;
  organizationId: string;
  roleName: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

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

export async function signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_REFRESH_EXPIRY_SECONDS}s`)
    .sign(encodeSecret(env.JWT_REFRESH_SECRET));
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(env.JWT_ACCESS_SECRET));
    return payload as unknown as AccessTokenPayload;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new UnauthorizedError('Access token has expired');
    }
    throw new UnauthorizedError('Invalid access token');
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(env.JWT_REFRESH_SECRET));
    return payload as unknown as RefreshTokenPayload;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new UnauthorizedError('Refresh token has expired');
    }
    throw new UnauthorizedError('Invalid refresh token');
  }
}
