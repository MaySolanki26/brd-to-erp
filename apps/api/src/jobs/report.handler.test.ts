import { describe, expect, it, vi, beforeEach } from 'vitest';
import type PgBoss from 'pg-boss';

vi.mock('../config/env.js', async () => (await import('../test/test-env.js')).envModule);
vi.mock('../lib/logger.js', async () => (await import('../test/test-env.js')).loggerModule);

import type { ReportGeneration } from '../modules/report/report.generation.js';
import {
  InvalidLlmOutputError,
  LlmBudgetExceededError,
  LlmConfigError,
  LlmOutputTooLongError,
  LlmRefusalError,
  LlmTransientError,
} from '../services/llm/llm.errors.js';
import { BUDGET_RETRY_SECONDS } from './understanding.handlers.js';
import {
  REPORT_AI_UNAVAILABLE,
  REPORT_FAILED,
  REPORT_TOO_LONG,
  createReportHandler,
} from './report.handler.js';

const payload = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000002',
  reportVersionId: '00000000-0000-4000-8000-000000000003',
};

function setup(retry = { retryCount: 0, retryLimit: 3 }) {
  const send = vi.fn().mockResolvedValue('job-id');
  const service = { generateContent: vi.fn(), failGeneration: vi.fn() };
  const handler = createReportHandler(
    { send } as unknown as PgBoss,
    service as unknown as ReportGeneration,
  );
  const run = () =>
    handler([{ id: 'j1', data: payload, ...retry }] as unknown as PgBoss.JobWithMetadata<
      typeof payload
    >[]);
  return { send, service, run };
}

describe('report handler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes the report and leaves the version alone on success', async () => {
    const { service, run } = setup();
    service.generateContent.mockResolvedValue('generated');
    await run();
    expect(service.generateContent).toHaveBeenCalledWith(payload);
    expect(service.failGeneration).not.toHaveBeenCalled();
  });

  it('pauses the job when the budget is used up, without failing the version', async () => {
    const { send, service, run } = setup();
    service.generateContent.mockRejectedValue(new LlmBudgetExceededError(10, 5));
    await run();
    expect(send).toHaveBeenCalledWith(
      'generate-report',
      payload,
      expect.objectContaining({ startAfter: BUDGET_RETRY_SECONDS }),
    );
    expect(service.failGeneration).not.toHaveBeenCalled();
  });

  it.each([new LlmConfigError('no key'), new LlmRefusalError('refused')])(
    'fails the version at once when the model cannot do it (%s)',
    async (error) => {
      const { send, service, run } = setup();
      service.generateContent.mockRejectedValue(error);
      await run();
      expect(service.failGeneration).toHaveBeenCalledWith(payload, REPORT_AI_UNAVAILABLE);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('fails the version at once, with its own message, when the report is always cut off', async () => {
    const { send, service, run } = setup();
    service.generateContent.mockRejectedValue(new LlmOutputTooLongError(32_000));
    await run();
    expect(service.failGeneration).toHaveBeenCalledWith(payload, REPORT_TOO_LONG);
    expect(send).not.toHaveBeenCalled();
  });

  it('rethrows other errors so pg-boss retries, until the last attempt', async () => {
    const early = setup({ retryCount: 1, retryLimit: 3 });
    early.service.generateContent.mockRejectedValue(new LlmTransientError('busy'));
    await expect(early.run()).rejects.toBeInstanceOf(LlmTransientError);
    expect(early.service.failGeneration).not.toHaveBeenCalled();

    const last = setup({ retryCount: 3, retryLimit: 3 });
    last.service.generateContent.mockRejectedValue(new InvalidLlmOutputError('bad json'));
    await last.run();
    expect(last.service.failGeneration).toHaveBeenCalledWith(payload, REPORT_FAILED);
  });
});
