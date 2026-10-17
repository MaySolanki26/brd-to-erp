import { createHash, createHmac, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Keyed hash so audit rows cannot be reversed with a dictionary of likely email addresses. */
export function hashEmailForAudit(email: string): string {
  return createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(`audit-email:${email.trim().toLowerCase()}`)
    .digest('hex');
}
