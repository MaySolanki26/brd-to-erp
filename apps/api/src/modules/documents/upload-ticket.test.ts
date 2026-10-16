import { describe, it, expect, afterEach, vi } from 'vitest';
import { createUploadTicket, verifyUploadTicket, type UploadTicket } from './upload-ticket.js';

const SECRET = 'a-test-secret-of-sufficient-length';
const ticket: UploadTicket = {
  organizationId: 'o1',
  projectId: 'p1',
  userId: 'u1',
  fileKey: 'f1',
  fileName: 'brd.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 123,
  documentId: undefined,
};

describe('upload ticket', () => {
  afterEach(() => vi.useRealTimers());

  it('round-trips every field, including the optional document id', () => {
    expect(verifyUploadTicket(SECRET, createUploadTicket(SECRET, ticket))).toEqual(ticket);
    const withDoc = { ...ticket, documentId: 'd1' };
    expect(verifyUploadTicket(SECRET, createUploadTicket(SECRET, withDoc))).toEqual(withDoc);
  });

  it('rejects a ticket signed with another secret', () => {
    const token = createUploadTicket('another-secret-of-sufficient-length', ticket);
    expect(() => verifyUploadTicket(SECRET, token)).toThrow(/Invalid or expired/);
  });

  it('rejects any change to the payload', () => {
    const [, signature = ''] = createUploadTicket(SECRET, ticket).split('.');
    const forged = Buffer.from(
      JSON.stringify({ o: 'o2', p: 'p1', u: 'u1', k: 'f1', n: 'a', m: 'b', s: 1, exp: 9e12 }),
    ).toString('base64url');
    expect(() => verifyUploadTicket(SECRET, `${forged}.${signature}`)).toThrow(
      /Invalid or expired/,
    );
  });

  it('rejects expired tickets', () => {
    vi.useFakeTimers();
    const token = createUploadTicket(SECRET, ticket, 60);
    vi.advanceTimersByTime(61_000);
    expect(() => verifyUploadTicket(SECRET, token)).toThrow(/Invalid or expired/);
  });

  it('rejects malformed input', () => {
    for (const bad of ['', 'nodot', '.', 'a.b', '!!!.???']) {
      expect(() => verifyUploadTicket(SECRET, bad)).toThrow(/Invalid or expired/);
    }
  });

  it('does not accept a storage upload token as a ticket', () => {
    const encoded = Buffer.from(JSON.stringify({ fk: 'f', ct: 'x', exp: 9e12 })).toString(
      'base64url',
    );
    expect(() => verifyUploadTicket(SECRET, `${encoded}.sig`)).toThrow(/Invalid or expired/);
  });
});
