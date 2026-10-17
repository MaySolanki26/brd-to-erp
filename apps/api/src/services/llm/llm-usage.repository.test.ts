import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  llmUsage: { create: vi.fn(), aggregate: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import { recordUsage, tokensUsedSince } from './llm-usage.repository.js';

describe('llm-usage.repository', () => {
  beforeEach(() => vi.resetAllMocks());

  it('stores counts and timing with a computed total, and nothing else', async () => {
    await recordUsage({
      organizationId: 'o1',
      projectId: 'p1',
      model: 'm',
      promptName: 'extraction',
      promptTokens: 100,
      completionTokens: 25,
      cachedTokens: 40,
      latencyMs: 900,
      status: 'OK',
    });
    expect(prismaMock.llmUsage.create.mock.calls[0]?.[0].data).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      userId: null,
      model: 'm',
      promptName: 'extraction',
      promptTokens: 100,
      completionTokens: 25,
      totalTokens: 125,
      cachedTokens: 40,
      latencyMs: 900,
      status: 'OK',
    });
  });

  it('sums tokens for one project in one organization since a date', async () => {
    prismaMock.llmUsage.aggregate.mockResolvedValue({ _sum: { totalTokens: 1234 } });
    const since = new Date('2026-10-01T00:00:00Z');
    expect(await tokensUsedSince('o1', 'p1', since)).toBe(1234);
    expect(prismaMock.llmUsage.aggregate.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      createdAt: { gte: since },
    });
  });

  it('returns zero when nothing was used yet', async () => {
    prismaMock.llmUsage.aggregate.mockResolvedValue({ _sum: { totalTokens: null } });
    expect(await tokensUsedSince('o1', 'p1', new Date())).toBe(0);
  });
});
