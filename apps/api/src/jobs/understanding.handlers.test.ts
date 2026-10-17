import { describe, expect, it, vi, beforeEach } from 'vitest';
import type PgBoss from 'pg-boss';

vi.mock('../config/env.js', async () => (await import('../test/test-env.js')).envModule);
vi.mock('../lib/logger.js', async () => (await import('../test/test-env.js')).loggerModule);

import {
  InvalidLlmOutputError,
  LlmBudgetExceededError,
  LlmConfigError,
  LlmRefusalError,
  LlmTransientError,
} from '../services/llm/llm.errors.js';
import type { UnderstandingService } from '../modules/understanding/understanding.service.js';
import { BUDGET_RETRY_SECONDS, createUnderstandingHandlers } from './understanding.handlers.js';

const ORG = '00000000-0000-4000-8000-000000000001';
const PROJECT = '00000000-0000-4000-8000-000000000002';
const ANSWER = '00000000-0000-4000-8000-000000000003';

function setup() {
  const send = vi.fn().mockResolvedValue('job-id');
  const boss = { send } as unknown as PgBoss;
  const service = {
    refreshSummary: vi.fn(),
    generateQuestions: vi.fn(),
    applyAnswer: vi.fn(),
  };
  const handlers = createUnderstandingHandlers(boss, service as unknown as UnderstandingService);
  const job = <T>(data: T) => [{ id: 'j1', data }] as unknown as PgBoss.JobWithMetadata<T>[];
  return { send, service, handlers, job };
}

const base = { organizationId: ORG, projectId: PROJECT };
const queued = (send: ReturnType<typeof vi.fn>) =>
  send.mock.calls.map(([name, data, options]) => ({ name, data, options }));

describe('understanding handlers', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('the chain', () => {
    it('queues question generation after a summary was created, and only then', async () => {
      const { send, service, handlers, job } = setup();
      service.refreshSummary.mockResolvedValueOnce('created');
      await handlers.refreshSummary(job(base));
      expect(queued(send)).toEqual([
        expect.objectContaining({ name: 'generate-questions', data: base }),
      ]);

      send.mockClear();
      for (const outcome of ['unchanged', 'empty', 'skipped']) {
        service.refreshSummary.mockResolvedValueOnce(outcome);
        await handlers.refreshSummary(job(base));
      }
      expect(send).not.toHaveBeenCalled();
    });

    it('queues a summary refresh after an answer was applied, and not otherwise', async () => {
      const { send, service, handlers, job } = setup();
      service.applyAnswer.mockResolvedValueOnce({
        status: 'applied',
        changed: 1,
        conflicts: 0,
        followUps: 0,
      });
      await handlers.applyAnswer(job({ ...base, answerId: ANSWER }));
      expect(queued(send)).toEqual([
        expect.objectContaining({ name: 'refresh-summary', data: base }),
      ]);

      send.mockClear();
      service.applyAnswer.mockResolvedValueOnce({ status: 'already-applied' });
      await handlers.applyAnswer(job({ ...base, answerId: ANSWER }));
      expect(send).not.toHaveBeenCalled();
    });

    it('passes only ids to the next job', async () => {
      const { send, service, handlers, job } = setup();
      service.refreshSummary.mockResolvedValueOnce('created');
      await handlers.refreshSummary(job({ ...base, extra: 'ignored' }));
      expect(queued(send)[0]?.data).toEqual(base);
    });
  });

  describe('failures', () => {
    it('pauses a job whose project used up its token budget, by queuing it again for later', async () => {
      const { send, service, handlers, job } = setup();
      service.generateQuestions.mockRejectedValueOnce(new LlmBudgetExceededError(1000, 1000));
      await expect(handlers.generateQuestions(job(base))).resolves.toBeUndefined();
      expect(queued(send)).toEqual([
        {
          name: 'generate-questions',
          data: base,
          options: expect.objectContaining({ startAfter: BUDGET_RETRY_SECONDS }),
        },
      ]);
    });

    it('pauses answer application too, keeping the answer id', async () => {
      const { send, service, handlers, job } = setup();
      service.applyAnswer.mockRejectedValueOnce(new LlmBudgetExceededError(5, 5));
      await handlers.applyAnswer(job({ ...base, answerId: ANSWER }));
      expect(queued(send)[0]).toMatchObject({
        name: 'apply-answer',
        data: { ...base, answerId: ANSWER },
      });
    });

    it.each([
      ['a misconfigured model', new LlmConfigError()],
      ['a refusal', new LlmRefusalError()],
    ])('does not retry %s', async (_name, error) => {
      const { send, service, handlers, job } = setup();
      service.refreshSummary.mockRejectedValueOnce(error);
      await expect(handlers.refreshSummary(job(base))).resolves.toBeUndefined();
      expect(send).not.toHaveBeenCalled();
    });

    it.each([
      ['a busy provider', new LlmTransientError()],
      ['unusable output', new InvalidLlmOutputError()],
      ['an unexpected error', new Error('db down')],
    ])('lets pg-boss retry %s', async (_name, error) => {
      const { service, handlers, job } = setup();
      service.applyAnswer.mockRejectedValueOnce(error);
      await expect(handlers.applyAnswer(job({ ...base, answerId: ANSWER }))).rejects.toBe(error);
    });

    it('hands every job in a batch to the service', async () => {
      const { service, handlers } = setup();
      service.generateQuestions.mockResolvedValue({ status: 'generated', created: 0 });
      const jobs = [
        { id: 'a', data: base },
        { id: 'b', data: { ...base, projectId: '00000000-0000-4000-8000-000000000009' } },
      ] as unknown as PgBoss.JobWithMetadata<typeof base>[];
      await handlers.generateQuestions(jobs);
      expect(service.generateQuestions).toHaveBeenCalledTimes(2);
    });
  });
});
