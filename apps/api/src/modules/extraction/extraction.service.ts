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
