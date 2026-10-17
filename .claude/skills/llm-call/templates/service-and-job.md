# Repository, service, job and wiring

> Every file below was compiled, linted and tested in a scratch copy of this repository (2026-10-17). Copy it, then rename. Paths are relative to the repository root.

### `apps/api/src/modules/extraction/extraction.repository.ts`

```ts
import { summaryLlmOutputSchema, type SummaryLlmOutput } from '@brd/shared';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';

export interface ChunkToExtract {
  id: string;
  content: string;
  headingPath: string[];
}

/** Null when the chunk is not in this organization and project, so a forged id reads as missing. */
export async function findChunk(
  organizationId: string,
  projectId: string,
  chunkId: string,
): Promise<ChunkToExtract | null> {
  return prisma.chunk.findFirst({
    where: { id: chunkId, organizationId, projectId },
    select: { id: true, content: true, headingPath: true },
  });
}

/** The newest summary, or null when none exists or the stored JSON no longer matches the schema. */
export async function latestSummary(
  organizationId: string,
  projectId: string,
): Promise<SummaryLlmOutput | null> {
  const row = await prisma.projectSummary.findFirst({
    where: { organizationId, projectId },
    orderBy: { version: 'desc' },
    select: { content: true },
  });
  const parsed = summaryLlmOutputSchema.safeParse(row?.content);
  return parsed.success ? parsed.data : null;
}

/** Serializes extraction runs on one chunk, so two workers never insert the same requirement twice. */
export async function lockChunk(
  db: DbClient,
  organizationId: string,
  projectId: string,
  chunkId: string,
): Promise<void> {
  await db.chunk.updateMany({
    where: { id: chunkId, organizationId, projectId },
    data: { updatedAt: new Date() },
  });
}

/** Lower-cased titles of the live requirements already taken from this chunk. */
export async function existingTitles(
  db: DbClient,
  organizationId: string,
  projectId: string,
  chunkId: string,
): Promise<Set<string>> {
  const rows = await db.requirement.findMany({
    where: { organizationId, projectId, sourceChunkId: chunkId, deletedAt: null },
    select: { title: true },
  });
  return new Set(rows.map((row) => row.title.toLowerCase()));
}

export async function insertRequirements(
  db: DbClient,
  params: {
    organizationId: string;
    projectId: string;
    chunkId: string;
    requirements: { title: string; description: string }[];
  },
): Promise<number> {
  const result = await db.requirement.createMany({
    data: params.requirements.map((requirement) => ({
      title: requirement.title,
      description: requirement.description,
      status: 'OPEN' as const,
      sourceChunkId: params.chunkId,
      projectId: params.projectId,
      organizationId: params.organizationId,
      createdById: null,
    })),
  });
  return result.count;
}

/** A chunk the model could not read twice in a row waits for a person to look at it. */
export async function setNeedsReview(
  db: DbClient,
  organizationId: string,
  projectId: string,
  chunkId: string,
  needsReview: boolean,
): Promise<void> {
  await db.chunk.updateMany({
    where: { id: chunkId, organizationId, projectId },
    data: { needsReview },
  });
}

export type ExtractionRepository = {
  findChunk: typeof findChunk;
  latestSummary: typeof latestSummary;
  lockChunk: typeof lockChunk;
  existingTitles: typeof existingTitles;
  insertRequirements: typeof insertRequirements;
  setNeedsReview: typeof setNeedsReview;
};
```

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
import { InvalidLlmOutputError } from '../../services/llm/llm.errors.js';
import type { LlmService } from '../../services/llm/llm.service.js';
import type { createAuditLog } from '../audit/audit.repository.js';
import type { ExtractionRepository } from './extraction.repository.js';
import { extractionContext, extractionInput } from './prompt-input.js';

export const MAX_REQUIREMENTS_PER_CHUNK = 20;
const MAX_TITLE_CHARS = 200;
const MAX_DESCRIPTION_CHARS = 2000;

export type ExtractChunkOutcome =
  | { status: 'extracted'; created: number }
  | { status: 'needs-review' | 'skipped' };

export interface ExtractionDeps {
  repo: ExtractionRepository;
  llm: Pick<LlmService, 'run'>;
  transaction: <T>(fn: (tx: DbClient) => Promise<T>) => Promise<T>;
  audit: typeof createAuditLog;
}

/** Trims, drops empties and repeats, and caps the count: the model's answer is a draft, not a record. */
export function sanitizeRequirements(
  drafts: ExtractionLlmOutput['requirements'],
): { title: string; description: string }[] {
  const seen = new Set<string>();
  const kept: { title: string; description: string }[] = [];
  for (const draft of drafts) {
    const title = draft.title.trim().slice(0, MAX_TITLE_CHARS);
    const description = draft.description.trim().slice(0, MAX_DESCRIPTION_CHARS);
    if (title === '' || description === '' || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    kept.push({ title, description });
    if (kept.length === MAX_REQUIREMENTS_PER_CHUNK) break;
  }
  return kept;
}

export interface ExtractionService {
  /** Lists the requirements one chunk states. Running it again adds nothing new. */
  extractChunk(payload: ExtractChunkPayload): Promise<ExtractChunkOutcome>;
}

export function createExtractionService(deps: ExtractionDeps): ExtractionService {
  const { repo, llm, transaction, audit } = deps;

  async function extractChunk(payload: ExtractChunkPayload): Promise<ExtractChunkOutcome> {
    const { organizationId, projectId, chunkId } = payload;
    const chunk = await repo.findChunk(organizationId, projectId, chunkId);
    if (!chunk) return { status: 'skipped' };

    const summary = await repo.latestSummary(organizationId, projectId);
    let output: ExtractionLlmOutput;
    try {
      ({ output } = await llm.run({
        promptName: 'extraction',
        cachedContext: summary ? extractionContext(summary) : undefined,
        user: extractionInput(chunk),
        schema: extractionLlmOutputSchema,
        outputJsonSchema: providerJsonSchema(extractionLlmOutputSchema),
        context: { organizationId, projectId },
      }));
    } catch (err) {
      // llm.run already asked twice. Retrying the job would pay for two more calls on the same text.
      if (!(err instanceof InvalidLlmOutputError)) throw err;
      await transaction((tx) => repo.setNeedsReview(tx, organizationId, projectId, chunkId, true));
      logger.warn({ projectId, chunkId }, 'Chunk marked for review after unusable LLM output');
      return { status: 'needs-review' };
    }

    const drafts = sanitizeRequirements(output.requirements);
    return transaction(async (tx) => {
      await repo.lockChunk(tx, organizationId, projectId, chunkId);
      // Another worker may have stored the same requirements while the model was thinking.
      const existing = await repo.existingTitles(tx, organizationId, projectId, chunkId);
      const fresh = drafts.filter((draft) => !existing.has(draft.title.toLowerCase()));
      if (fresh.length > 0) {
        await repo.insertRequirements(tx, {
          organizationId,
          projectId,
          chunkId,
          requirements: fresh,
        });
        await audit(
          {
            action: 'CREATE',
            entity: 'Requirement',
            organizationId,
            metadata: { projectId, chunkId, created: fresh.length },
          },
          tx,
        );
      }
      await repo.setNeedsReview(tx, organizationId, projectId, chunkId, false);
      logger.info({ projectId, chunkId, created: fresh.length }, 'Chunk extracted');
      return { status: 'extracted' as const, created: fresh.length };
    });
  }

  return { extractChunk };
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
import type { ExtractionService } from '../modules/extraction/extraction.service.js';
import { guarded } from './understanding.handlers.js';

export function createExtractionHandler(boss: PgBoss, service: ExtractionService) {
  return async (jobs: PgBoss.JobWithMetadata<ExtractChunkPayload>[]): Promise<void> => {
    for (const job of jobs) {
      await guarded(boss, JobName.EXTRACT_CHUNK, job, async () => {
        await service.extractChunk(job.data);
      });
    }
  };
}
```

### Small edits to existing files

```ts
// apps/api/src/jobs/understanding.handlers.ts — share the failure sorting
type UnderstandingJob =
  typeof JobName.REFRESH_SUMMARY | typeof JobName.GENERATE_QUESTIONS | typeof JobName.APPLY_ANSWER;
/** Every job that calls the model goes through `guarded`. */
export type LlmJob = UnderstandingJob | typeof JobName.EXTRACT_CHUNK;

export async function guarded<N extends LlmJob>(/* unchanged */) { /* unchanged */ }

// apps/api/src/modules/understanding/prompt-inputs.ts
export function wrap(data: unknown): string { /* unchanged */ }

// apps/api/src/jobs/index.ts
import { extractionService } from '../modules/extraction/extraction.runtime.js';
import { createExtractionHandler } from './extraction.handler.js';
// ...inside registerAllHandlers, after the existing boss.work calls:
await boss.work(
  JobName.EXTRACT_CHUNK,
  { includeMetadata: true },
  createExtractionHandler(boss, extractionService),
);
```

### Enqueueing (from a service or a handler)

```ts
import { enqueueJob } from '../../services/queue.service.js';
import { JobName } from '@brd/shared';

await enqueueJob(JobName.EXTRACT_CHUNK, { organizationId, projectId, chunkId });
```

## Why it looks like this

- The service is a factory over `deps`, so tests script `llm.run` and the repository without mocking modules.
- `InvalidLlmOutputError` is caught only around `llm.run`, and only for per-chunk work: the chunk is flagged and the job succeeds, instead of paying for two more calls on every pg-boss retry.
- `lockChunk` touches the chunk row inside the transaction, so a second worker waits and then sees the first worker's titles in `existingTitles`.
- Audit `metadata` is `{ projectId, chunkId, created }`: ids and a count, no text.
