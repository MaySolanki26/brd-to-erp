import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({ auditLog: { create: vi.fn() } }));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import { createAuditLog } from './audit.repository.js';

describe('audit.repository', () => {
  beforeEach(() => vi.resetAllMocks());

  it('nulls optional fields so failed logins without a user can be recorded', async () => {
    await createAuditLog({ action: 'LOGIN_FAILURE', entity: 'Auth' });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'LOGIN_FAILURE',
        entity: 'Auth',
        entityId: null,
        userId: null,
        organizationId: null,
        metadata: undefined,
      },
    });
  });

  it('writes through the supplied transaction client instead of the global client', async () => {
    const tx = { auditLog: { create: vi.fn() } };
    await createAuditLog(
      { action: 'CREATE', entity: 'Project', entityId: 'p1', userId: 'u1', organizationId: 'o1' },
      tx as never,
    );
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });
});
