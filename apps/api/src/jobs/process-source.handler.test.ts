import { describe, expect, it, vi, beforeEach } from 'vitest';
import type PgBoss from 'pg-boss';

const processSource = vi.hoisted(() => vi.fn());
vi.mock('../config/env.js', async () => (await import('../test/test-env.js')).envModule);
vi.mock('../lib/logger.js', async () => (await import('../test/test-env.js')).loggerModule);
vi.mock('../modules/sources/process-source.service.js', () => ({ processSource }));

import { createProcessSourceHandler } from './process-source.handler.js';

const data = {
  organizationId: 'o1',
  projectId: 'p1',
  sourceType: 'note' as const,
  sourceId: 'n1',
};
const jobs = [
  { id: 'j1', data, retryCount: 0, retryLimit: 3 },
] as unknown as PgBoss.JobWithMetadata<typeof data>[];

describe('process-source handler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queues a summary refresh once a source has been processed', async () => {
    const send = vi.fn().mockResolvedValue('id');
    processSource.mockResolvedValue('processed');
    await createProcessSourceHandler({ send } as unknown as PgBoss)(jobs);
    expect(send).toHaveBeenCalledWith(
      'refresh-summary',
      { organizationId: 'o1', projectId: 'p1' },
      expect.anything(),
    );
  });

  it.each(['skipped', 'failed', 'superseded'])(
    'queues nothing when the outcome is %s',
    async (outcome) => {
      const send = vi.fn();
      processSource.mockResolvedValue(outcome);
      await createProcessSourceHandler({ send } as unknown as PgBoss)(jobs);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('does not fail the job when the follow-up cannot be queued', async () => {
    const send = vi.fn().mockRejectedValue(new Error('queue down'));
    processSource.mockResolvedValue('processed');
    await expect(
      createProcessSourceHandler({ send } as unknown as PgBoss)(jobs),
    ).resolves.toBeUndefined();
  });

  it('still lets a processing error reach pg-boss for retry', async () => {
    processSource.mockRejectedValue(new Error('transient'));
    await expect(
      createProcessSourceHandler({ send: vi.fn() } as unknown as PgBoss)(jobs),
    ).rejects.toThrow('transient');
  });
});
