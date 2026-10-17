import { describe, expect, it, vi, beforeEach } from 'vitest';
import type PgBoss from 'pg-boss';

vi.mock('../config/env.js', async () => (await import('../test/test-env.js')).envModule);
vi.mock('../lib/logger.js', async () => (await import('../test/test-env.js')).loggerModule);

import type { ExtractChunkPayload } from '@brd/shared';
import type { ExtractionService } from '../modules/extraction/extraction.service.js';
import { LlmBudgetExceededError, LlmConfigError } from '../services/llm/llm.errors.js';
import {
  AI_UNAVAILABLE,
  SUMMARY_REFRESH_WINDOW_SECONDS,
  createExtractionHandler,
} from './extraction.handler.js';
import { BUDGET_RETRY_SECONDS } from './understanding.handlers.js';

const data: ExtractChunkPayload = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000002',
  chunkId: '00000000-0000-4000-8000-000000000003',
};
const jobAt = (retryCount: number) =>
  [{ id: 'j1', data, retryCount, retryLimit: 3 }] as unknown as PgBoss.JobWithMetadata<ExtractChunkPayload>[];
const jobs = jobAt(0);

function setup() {
  const send = vi.fn().mockResolvedValue('job-id');
  const service = { extractChunk: vi.fn(), giveUp: vi.fn(), failSource: vi.fn() };
  const handler = createExtractionHandler(
    { send } as unknown as PgBoss,
    service as unknown as ExtractionService,
  );
  return { send, service, handler };
}

describe('extraction handler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queues one summary refresh per project window when the last chunk of a source is done', async () => {
    const { send, service, handler } = setup();
    service.extractChunk.mockResolvedValue({
      status: 'extracted', created: 1, linked: 0, removed: 0, sourceFinished: true,
    });
    await handler(jobs);
    expect(send).toHaveBeenCalledWith(
      'refresh-summary',
      { organizationId: data.organizationId, projectId: data.projectId },
      expect.objectContaining({
        singletonKey: `refresh-summary:${data.projectId}`,
        singletonSeconds: SUMMARY_REFRESH_WINDOW_SECONDS,
      }),
    );
  });

  it('also refreshes when the last chunk was flagged for review', async () => {
    const { send, service, handler } = setup();
    service.extractChunk.mockResolvedValue({ status: 'needs-review', sourceFinished: true });
    await handler(jobs);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a chunk with others still waiting', { status: 'extracted', created: 1, linked: 0, removed: 0, sourceFinished: false }],
    ['a flagged chunk with others waiting', { status: 'needs-review', sourceFinished: false }],
    ['a skipped chunk', { status: 'skipped' }],
  ])('queues nothing after %s', async (_name, outcome) => {
    const { send, service, handler } = setup();
    service.extractChunk.mockResolvedValue(outcome);
    await handler(jobs);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not fail the job when the refresh cannot be queued', async () => {
    const { send, service, handler } = setup();
    service.extractChunk.mockResolvedValue({ status: 'needs-review', sourceFinished: true });
    send.mockRejectedValue(new Error('queue down'));
    await expect(handler(jobs)).resolves.toBeUndefined();
  });

  it('pauses a job whose project used up its budget, keeping the same payload', async () => {
    const { send, service, handler } = setup();
    service.extractChunk.mockRejectedValue(new LlmBudgetExceededError(10, 10));
    await handler(jobs);
    expect(send).toHaveBeenCalledWith(
      'extract-chunk',
      data,
      expect.objectContaining({ startAfter: BUDGET_RETRY_SECONDS }),
    );
  });

  it('fails the source, without retrying, when the model is misconfigured', async () => {
    const { send, service, handler } = setup();
    service.extractChunk.mockRejectedValue(new LlmConfigError());
    await expect(handler(jobs)).resolves.toBeUndefined();
    expect(service.failSource).toHaveBeenCalledWith(data, AI_UNAVAILABLE);
    expect(send).not.toHaveBeenCalled();
  });

  it('lets an unexpected error reach pg-boss for a retry while retries remain', async () => {
    const { service, handler } = setup();
    const error = new Error('db down');
    service.extractChunk.mockRejectedValue(error);
    await expect(handler(jobAt(2))).rejects.toBe(error);
    expect(service.giveUp).not.toHaveBeenCalled();
  });

  it('flags the chunk for review after the last retry, so its source can still finish', async () => {
    const { send, service, handler } = setup();
    service.extractChunk.mockRejectedValue(new Error('db down'));
    service.giveUp.mockResolvedValue({ status: 'needs-review', sourceFinished: true });
    await expect(handler(jobAt(3))).resolves.toBeUndefined();
    expect(service.giveUp).toHaveBeenCalledWith(data);
    expect(send).toHaveBeenCalledWith('refresh-summary', expect.anything(), expect.anything());
  });

  it('still pauses for the budget on the last retry', async () => {
    const { send, service, handler } = setup();
    service.extractChunk.mockRejectedValue(new LlmBudgetExceededError(10, 10));
    await handler(jobAt(3));
    expect(service.giveUp).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith('extract-chunk', data, expect.anything());
  });
});
