import { createHmac, timingSafeEqual } from 'node:crypto';
import { ValidationError } from '../../errors/app-error.js';

export const UPLOAD_TICKET_TTL_SECONDS = 60 * 60;

export interface UploadTicket {
  organizationId: string;
  projectId: string;
  userId: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Present when the upload is a new version of an existing document. */
  documentId?: string | undefined;
}

interface TicketPayload {
  o: string;
  p: string;
  u: string;
  k: string;
  n: string;
  m: string;
  s: number;
  d?: string;
  exp: number;
}

const INVALID = 'Invalid or expired upload ticket';

// A separate key domain keeps a storage upload token from ever being accepted as a ticket.
function sign(encoded: string, secret: string): string {
  return createHmac('sha256', `${secret}:upload-ticket`).update(encoded).digest('base64url');
}

export function createUploadTicket(
  secret: string,
  ticket: UploadTicket,
  ttlSeconds = UPLOAD_TICKET_TTL_SECONDS,
): string {
  const payload: TicketPayload = {
    o: ticket.organizationId,
    p: ticket.projectId,
    u: ticket.userId,
    k: ticket.fileKey,
    n: ticket.fileName,
    m: ticket.mimeType,
    s: ticket.sizeBytes,
    ...(ticket.documentId && { d: ticket.documentId }),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded, secret)}`;
}

function isPayload(value: unknown): value is TicketPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['o'] === 'string' &&
    typeof v['p'] === 'string' &&
    typeof v['u'] === 'string' &&
    typeof v['k'] === 'string' &&
    typeof v['n'] === 'string' &&
    typeof v['m'] === 'string' &&
    typeof v['s'] === 'number' &&
    typeof v['exp'] === 'number' &&
    (v['d'] === undefined || typeof v['d'] === 'string')
  );
}

export function verifyUploadTicket(secret: string, token: string): UploadTicket {
  const dot = token.indexOf('.');
  if (dot === -1) throw new ValidationError(INVALID);

  const encoded = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(encoded, secret));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new ValidationError(INVALID);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new ValidationError(INVALID);
  }
  if (!isPayload(payload) || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new ValidationError(INVALID);
  }

  return {
    organizationId: payload.o,
    projectId: payload.p,
    userId: payload.u,
    fileKey: payload.k,
    fileName: payload.n,
    mimeType: payload.m,
    sizeBytes: payload.s,
    documentId: payload.d,
  };
}
