# Service, job and wiring

Real files. The repository (`extraction.repository.ts`) and the merge planner (`extraction.plan.ts`) are longer; read them next to these.

### `apps/api/src/modules/extraction/extraction.service.ts`

```ts
import {
  extractionLlmOutputSchema,
  type ExtractChunkPayload,
  type ExtractionLlmOutput,
} from '@brd/shared';
import { logger } from '../../lib/logger.js';
import type { DbClient } from '../../lib/transaction.js';
import { providerJsonSchema } from '../../services/llm/json-schema.js';
import { InvalidLlmOutputError, LlmRefusalError } from '../../services/llm/llm.errors.js';
import type { LlmService } from '../../services/llm/llm.service.js';
import type { createAuditLog } from '../audit/audit.repository.js';
import { isEmptyPlan, planExtraction, sanitizeDrafts } from './extraction.plan.js';
import type { ExtractionRepository } from './extraction.repository.js';
import { extractionInput } from './prompt-input.js';

export type ExtractChunkOutcome =
  | {
      status: 'extracted';
      created: number;
      linked: number;
      removed: number;
      /** This was the last chunk of its source: the source is now processed. */
      sourceFinished: boolean;
    }
  | { status: 'needs-review'; sourceFinished: boolean }
  | { status: 'skipped' };

export interface ExtractionDeps {
  repo: ExtractionRepository;
  llm: Pick<LlmService, 'run'>;
  transaction: <T>(fn: (tx: DbClient) => Promise<T>) => Promise<T>;
  audit: typeof createAuditLog;
}

export interface ExtractionService {
  /**
   * Lists the modules, requirements and rules one chunk states and merges them into the project.
   * Running it again on the same chunk changes nothing.
   */
  extractChunk(payload: ExtractChunkPayload): Promise<ExtractChunkOutcome>;
  /**
   * The job ran out of retries. Flag the chunk for review and count it as done, so its source can
   * finish instead of waiting forever on a chunk that keeps failing.
   */
  giveUp(payload: ExtractChunkPayload): Promise<ExtractChunkOutcome>;
  /** The model cannot be used at all: fail the chunk's source so a person can reprocess it later. */
  failSource(payload: ExtractChunkPayload, reason: string): Promise<void>;
}

export function createExtractionService(deps: ExtractionDeps): ExtractionService {
  const { repo, llm, transaction, audit } = deps;

  async function flagForReview(
    scope: { organizationId: string; projectId: string },
    chunkId: string,
  ): Promise<ExtractChunkOutcome> {
    const sourceFinished = await transaction(async (tx) => {
      await repo.lockProject(tx, scope.projectId);
      await repo.markExtracted(tx, scope, chunkId, true);
      return repo.finishSourceIfDone(tx, scope, chunkId);
    });
    logger.warn({ projectId: scope.projectId, chunkId }, 'Chunk flagged for review');
    return { status: 'needs-review', sourceFinished };
  }

  async function extractChunk(payload: ExtractChunkPayload): Promise<ExtractChunkOutcome> {
    const { organizationId, projectId, chunkId } = payload;
    const scope = { organizationId, projectId };

    const chunk = await repo.findChunk(organizationId, projectId, chunkId);
    // A forged id, a chunk replaced since the job was queued, or an older version: nothing to do.
    if (!chunk?.current) return { status: 'skipped' };

    let output: ExtractionLlmOutput;
    try {
      ({ output } = await llm.run({
        promptName: 'extraction',
        user: extractionInput(chunk),
        schema: extractionLlmOutputSchema,
        outputJsonSchema: providerJsonSchema(extractionLlmOutputSchema),
        context: scope,
      }));
    } catch (err) {
      // llm.run already asked twice, or the model declined this text. Retrying the job would pay for
      // more calls on the same text, so a person looks at the chunk instead.
      if (err instanceof InvalidLlmOutputError || err instanceof LlmRefusalError) {
        return flagForReview(scope, chunkId);
      }
      throw err;
    }

    const drafts = sanitizeDrafts(output);
    return transaction(async (tx) => {
      await repo.lockProject(tx, projectId);
      const existing = await repo.loadExisting(tx, scope, chunkId, drafts);
      const plan = planExtraction(drafts, existing);
      const counts = await repo.applyPlan(tx, scope, chunkId, plan);
      await repo.markExtracted(tx, scope, chunkId, false);
      const sourceFinished = await repo.finishSourceIfDone(tx, scope, chunkId);

      if (!isEmptyPlan(plan)) {
        await audit(
          {
            action: 'CREATE',
            entity: 'KnowledgeItem',
            organizationId,
            metadata: { projectId, chunkId, ...counts },
          },
          tx,
        );
      }
      logger.info({ projectId, chunkId, ...counts }, 'Chunk extracted');
      return {
        status: 'extracted' as const,
        created: counts.created,
        linked: counts.linked,
        removed: counts.removed,
        sourceFinished,
      };
    });
  }

  async function giveUp(payload: ExtractChunkPayload): Promise<ExtractChunkOutcome> {
    const { organizationId, projectId, chunkId } = payload;
    const chunk = await repo.findChunk(organizationId, projectId, chunkId);
    if (!chunk?.current) return { status: 'skipped' };
    return flagForReview({ organizationId, projectId }, chunkId);
  }

  async function failSource(payload: ExtractChunkPayload, reason: string): Promise<void> {
    const { organizationId, projectId, chunkId } = payload;
    await transaction((tx) =>
      repo.failSourceOfChunk(tx, { organizationId, projectId }, chunkId, reason),
    );
  }

  return { extractChunk, giveUp, failSource };
}
```

### `apps/api/src/modules/extraction/extraction.runtime.ts`

```ts
import { withTransaction } from '../../lib/transaction.js';
import { llmService } from '../../services/llm/index.js';
import { createAuditLog } from '../audit/audit.repository.js';
import * as repo from './extraction.repository.js';
import { createExtractionService } from './extraction.service.js';

/** Extraction wired to the real database and the configured LLM driver. */
export const extractionService = createExtractionService({
  repo,
  llm: llmService,
  transaction: withTransaction,
  audit: createAuditLog,
});
```

### `apps/api/src/jobs/extraction.handler.ts`

```ts
import type PgBoss from 'pg-boss';
import { JobName, type ExtractChunkPayload } from '@brd/shared';
import { logger } from '../lib/logger.js';
import { LlmBudgetExceededError, LlmConfigError } from '../services/llm/llm.errors.js';
import type { ExtractionService } from '../modules/extraction/extraction.service.js';
import { enqueue } from '../services/queue.service.js';
import { guarded } from './understanding.handlers.js';

/** One summary refresh per project per window, however many chunks finish in a burst. */
export const SUMMARY_REFRESH_WINDOW_SECONDS = 30;

export const AI_UNAVAILABLE = 'The AI service is not available. Try reprocessing later.';

export function createExtractionHandler(boss: PgBoss, service: ExtractionService) {
  /**
   * Runs one chunk. A budget error goes up to `guarded`, which pauses the job. A misconfigured model
   * fails the source so it can be reprocessed after the fix. Any other error is retried by pg-boss;
   * after the last retry the chunk is flagged for review so its source can still finish.
   */
  async function runChunk(job: PgBoss.JobWithMetadata<ExtractChunkPayload>) {
    try {
      return await service.extractChunk(job.data);
    } catch (err) {
      if (err instanceof LlmBudgetExceededError) throw err;
      if (err instanceof LlmConfigError) {
        await service.failSource(job.data, AI_UNAVAILABLE);
        return undefined;
      }
      if (job.retryCount < job.retryLimit) throw err;
      logger.error({ err, jobId: job.id, chunkId: job.data.chunkId }, 'Extraction gave up');
      return service.giveUp(job.data);
    }
  }

  return async (jobs: PgBoss.JobWithMetadata<ExtractChunkPayload>[]): Promise<void> => {
    for (const job of jobs) {
      await guarded(boss, JobName.EXTRACT_CHUNK, job, async () => {
        const outcome = await runChunk(job);
        if (!outcome || outcome.status === 'skipped' || !outcome.sourceFinished) return;

        // New knowledge may change the summary, which then asks its questions. The source is already
        // processed, so a failure here must not fail (and re-run) this job.
        const { organizationId, projectId } = job.data;
        try {
          await enqueue(
            boss,
            JobName.REFRESH_SUMMARY,
            { organizationId, projectId },
            {
              singletonKey: `refresh-summary:${projectId}`,
              singletonSeconds: SUMMARY_REFRESH_WINDOW_SECONDS,
            },
          );
        } catch (err) {
          logger.warn({ err, jobId: job.id, projectId }, 'Could not queue summary refresh');
        }
      });
    }
  };
}
```

### Registering the job

```ts
// apps/api/src/jobs/index.ts — inside registerAllHandlers, after the existing boss.work calls
await boss.work(
  JobName.EXTRACT_CHUNK,
  { includeMetadata: true },
  createExtractionHandler(boss, extractionService),
);

// apps/api/src/jobs/understanding.handlers.ts
export type LlmJob = UnderstandingJob | typeof JobName.EXTRACT_CHUNK;
export async function guarded<N extends LlmJob>(/* ... */) { /* ... */ }
```

### Enqueueing

```ts
import { enqueue } from '../services/queue.service.js';
import { JobName } from '@brd/shared';

// From a handler (has the boss):
await enqueue(boss, JobName.EXTRACT_CHUNK, { organizationId, projectId, chunkId });
// Many identical requests in a burst become one job per window:
await enqueue(boss, JobName.REFRESH_SUMMARY, { organizationId, projectId }, {
  singletonKey: `refresh-summary:${projectId}`,
  singletonSeconds: 30,
});
```

## Why it looks like this

- The service is a factory over `deps`, so tests script `llm.run` and the repository without mocking modules. `fake-repository.ts` is an in-memory repository with the real one's rules.
- `InvalidLlmOutputError` is caught only around `llm.run`, and only for per-chunk work: the chunk is flagged for review and counts as done, instead of paying for two more calls on every pg-boss retry.
- The planner is a pure function, so the merge rules (create, link, update, remove, unlink) are tested without a database.
- Audit `metadata` is `{ projectId, chunkId, created, linked, updated, removed }`: ids and counts, no text.
- The source stays `PROCESSING` until its last chunk is extracted; the call that finishes it reports `sourceFinished`, and the handler then queues one summary refresh.
