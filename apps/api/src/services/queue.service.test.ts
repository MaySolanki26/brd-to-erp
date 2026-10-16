import { describe, it, expect, vi, beforeEach } from 'vitest';

const boss = vi.hoisted(() => ({
  start: vi.fn(),
  send: vi.fn(),
  stop: vi.fn(),
}));
const bossModule = vi.hoisted(() => ({
  createBoss: vi.fn(),
  ensureQueues: vi.fn(),
}));
vi.mock('../lib/boss.js', () => bossModule);

const payload = {
  organizationId: 'o1',
  projectId: 'p1',
  sourceType: 'note' as const,
  sourceId: 'n1',
};

describe('queue.service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    bossModule.createBoss.mockReturnValue(boss);
    boss.start.mockResolvedValue(undefined);
    boss.send.mockResolvedValue('job-1');
    boss.stop.mockResolvedValue(undefined);
    bossModule.ensureQueues.mockResolvedValue(undefined);
  });

  it('starts one shared boss, creates the queues and sends with retry options', async () => {
    const { enqueueJob } = await import('./queue.service.js');
    expect(await enqueueJob('process-source', payload)).toBe('job-1');
    await enqueueJob('process-source', payload);

    expect(bossModule.createBoss).toHaveBeenCalledTimes(1);
    expect(boss.start).toHaveBeenCalledTimes(1);
    expect(bossModule.ensureQueues).toHaveBeenCalledWith(boss);
    expect(boss.send).toHaveBeenCalledWith('process-source', payload, {
      retryLimit: 3,
      retryDelay: 15,
      retryBackoff: true,
    });
  });

  it('retries the startup on the next call after it failed', async () => {
    boss.start.mockRejectedValueOnce(new Error('db down'));
    const { enqueueJob } = await import('./queue.service.js');
    await expect(enqueueJob('process-source', payload)).rejects.toThrow('db down');
    await expect(enqueueJob('process-source', payload)).resolves.toBe('job-1');
    expect(boss.start).toHaveBeenCalledTimes(2);
  });

  it('stops the shared boss gracefully, and does nothing when never started', async () => {
    const { enqueueJob, stopQueue } = await import('./queue.service.js');
    await stopQueue();
    expect(boss.stop).not.toHaveBeenCalled();

    await enqueueJob('process-source', payload);
    await stopQueue();
    expect(boss.stop).toHaveBeenCalledWith({ graceful: true, timeout: 5000 });
  });
});
