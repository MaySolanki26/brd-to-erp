import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
vi.mock('../config/env.js', async () => (await import('../test/test-env.js')).envModule);
vi.mock('../modules/auth/auth.service.js', () => ({}));

import { requireOrgRole } from './require-org-role.js';

function respondingAs(orgRole?: string): Response {
  return { locals: orgRole ? { authUser: { orgRole } } : {} } as unknown as Response;
}

describe('requireOrgRole', () => {
  it('passes a user with an allowed role', () => {
    const next = vi.fn();
    requireOrgRole('ORG_ADMIN')({} as Request, respondingAs('ORG_ADMIN'), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects other roles with 403', () => {
    const next = vi.fn();
    requireOrgRole('ORG_ADMIN')({} as Request, respondingAs('MEMBER'), next);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('rejects an unauthenticated request with 401', () => {
    const next = vi.fn();
    requireOrgRole('ORG_ADMIN')({} as Request, respondingAs(), next);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401 });
  });
});
