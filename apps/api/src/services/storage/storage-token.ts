import { createHmac, timingSafeEqual } from 'node:crypto';
import { ValidationError } from '../../errors/app-error.js';

interface TokenPayload {
  /** file key (UUID) */
  fk: string;
  /** content type */
  ct: string;
  /** expiry as epoch seconds */
  exp: number;
}

export interface VerifiedToken {
  fileKey: string;
  contentType: string;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createUploadToken(
  secret: string,
  fileKey: string,
  contentType: string,
  ttlSeconds: number,
): string {
  const payload: TokenPayload = {
    fk: fileKey,
    ct: contentType,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifyUploadToken(secret: string, token: string): VerifiedToken {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) {
    throw new ValidationError('Invalid upload token');
  }

  const encoded = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);

  const expectedSig = sign(encoded, secret);

  if (
    providedSig.length !== expectedSig.length ||
    !timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))
  ) {
    throw new ValidationError('Invalid upload token');
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
  } catch {
    throw new ValidationError('Invalid upload token');
  }

  if (typeof payload.fk !== 'string' || typeof payload.ct !== 'string' || typeof payload.exp !== 'number') {
    throw new ValidationError('Invalid upload token');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new ValidationError('Upload token has expired');
  }

  return { fileKey: payload.fk, contentType: payload.ct };
}
