import { describe, expect, it, vi, beforeEach } from 'vitest';
import type PgBoss from 'pg-boss';

const processSource = vi.hoisted(() => vi.fn());
const failSource = vi.hoisted(() => vi.fn());
vi.mock('../config/env.js', async () => (await import('../test/test-env.js')).envModule);
vi.mock('../lib/logger.js', async () => (await import('../test/test-env.js')).loggerModule);
vi.mock('../modules/sources/process-source.service.js', () => ({ processSource, failSource }));

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

const done = (outcome: string) => ({ outcome, chunkIds: [] });

describe('process-source handler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queues a summary refresh once a source has been processed', async () => {
    const send = vi.fn().mockResolvedValue('id');
    processSource.mockResolvedValue(done('processed'));
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
      processSource.mockResolvedValue(done(outcome));
      await createProcessSourceHandler({ send } as unknown as PgBoss)(jobs);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('does not fail the job when the follow-up cannot be queued', async () => {
    const send = vi.fn().mockRejectedValue(new Error('queue down'));
    processSource.mockResolvedValue(done('processed'));
    await expect(
      createProcessSourceHandler({ send } as unknown as PgBoss)(jobs),
    ).resolves.toBeUndefined();
  });

  it('queues one extraction job per chunk instead of a summary refresh', async () => {
    const send = vi.fn().mockResolvedValue('id');
    processSource.mockResolvedValue({ outcome: 'extracting', chunkIds: ['c1', 'c2'] });
    await createProcessSourceHandler({ send } as unknown as PgBoss)(jobs);
    expect(send.mock.calls.map(([name, payload]) => [name, payload])).toEqual([
      ['extract-chunk', { organizationId: 'o1', projectId: 'p1', chunkId: 'c1' }],
      ['extract-chunk', { organizationId: 'o1', projectId: 'p1', chunkId: 'c2' }],
    ]);
  });

  it('fails the source, instead of leaving it processing, when extraction cannot be queued', async () => {
    const send = vi.fn().mockRejectedValue(new Error('queue down'));
    processSource.mockResolvedValue({ outcome: 'extracting', chunkIds: ['c1'] });
    await expect(
      createProcessSourceHandler({ send } as unknown as PgBoss)(jobs),
    ).resolves.toBeUndefined();
    expect(failSource).toHaveBeenCalledWith(data, expect.stringMatching(/Try reprocessing/));
  });

  it('still lets a processing error reach pg-boss for retry', async () => {
    processSource.mockRejectedValue(new Error('transient'));
    await expect(
      createProcessSourceHandler({ send: vi.fn() } as unknown as PgBoss)(jobs),
    ).rejects.toThrow('transient');
  });
});
