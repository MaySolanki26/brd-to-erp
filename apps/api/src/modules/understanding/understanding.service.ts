import {
  applyAnswerLlmOutputSchema,
  questionsLlmOutputSchema,
  summaryLlmOutputSchema,
  type ApplyAnswerLlmOutput,
  type ApplyAnswerPayload,
  type GenerateQuestionsPayload,
  type RefreshSummaryPayload,
} from '@brd/shared';
import { logger } from '../../lib/logger.js';
import type { DbClient } from '../../lib/transaction.js';
import type { createAuditLog } from '../audit/audit.repository.js';
import type { LlmService } from '../../services/llm/llm.service.js';
import { providerJsonSchema } from '../../services/llm/json-schema.js';
import { sanitizeSummary } from './build-summary.js';
import { summaryFingerprint } from './fingerprint.js';
import { conflictQuestion, planAnswer, type PlannedChange } from './plan-answer.js';
import { planQuestions } from './plan-questions.js';
import {
  MAX_EXISTING_QUESTIONS,
  applyAnswerInput,
  questionsInput,
  selectItemsForQuestions,
  summaryContext,
  summaryInput,
} from './prompt-inputs.js';
import type { UnderstandingRepository } from './understanding.repository.js';
import { itemKey } from './understanding.types.js';

export interface UnderstandingDeps {
  repo: UnderstandingRepository;
  llm: Pick<LlmService, 'run'>;
  transaction: <T>(fn: (tx: DbClient) => Promise<T>) => Promise<T>;
  audit: typeof createAuditLog;
}

export type RefreshSummaryOutcome = 'created' | 'unchanged' | 'empty' | 'skipped';
export type GenerateQuestionsOutcome =
  { status: 'generated'; created: number } | { status: 'empty' | 'skipped' };
export type ApplyAnswerOutcome =
  | { status: 'applied'; changed: number; conflicts: number; followUps: number }
  | { status: 'already-applied' | 'skipped' };

const NOTHING_TO_APPLY: ApplyAnswerLlmOutput = {
  changes: [],
  conflicts: [],
  followUpQuestions: [],
  decisionSummary: '',
};

const CONFIRMED_MEANWHILE =
  'This item was confirmed while the answer was being applied, so it was not changed.';

export interface UnderstandingService {
  /** Builds the next summary version, or does nothing when the items have not changed. */
  refreshSummary(payload: RefreshSummaryPayload): Promise<RefreshSummaryOutcome>;
  /** Asks the questions the project's items raise, skipping any gap already asked. */
  generateQuestions(payload: GenerateQuestionsPayload): Promise<GenerateQuestionsOutcome>;
  /** Applies one recorded answer exactly once. */
  applyAnswer(payload: ApplyAnswerPayload): Promise<ApplyAnswerOutcome>;
}

export function createUnderstandingService(deps: UnderstandingDeps): UnderstandingService {
  const { repo, llm, transaction, audit } = deps;

  async function refreshSummary(payload: RefreshSummaryPayload): Promise<RefreshSummaryOutcome> {
    const { organizationId, projectId } = payload;
    const name = await repo.projectName(organizationId, projectId);
    if (name === null) return 'skipped';

    const items = await repo.loadItems(organizationId, projectId);
    if (items.length === 0) return 'empty';

    const fingerprint = summaryFingerprint(items);
    const latest = await repo.latestSummary(organizationId, projectId);
    if (latest?.fingerprint === fingerprint && latest.content) return 'unchanged';

    const { output } = await llm.run({
      promptName: 'summary',
      user: summaryInput(name, items),
      schema: summaryLlmOutputSchema,
      outputJsonSchema: providerJsonSchema(summaryLlmOutputSchema),
      context: { organizationId, projectId },
    });
    const content = sanitizeSummary(output, items);
    const count = (kind: string) => items.filter((i) => i.kind === kind).length;
    const basedOn = {
      requirements: count('requirement'),
      rules: count('rule'),
      modules: count('module'),
      assumed: content.assumptions.length,
      stale: content.staleItems.length,
      openQuestions: await repo.countOpenQuestions(organizationId, projectId),
    };

    return transaction(async (tx) => {
      await repo.lockProject(tx, organizationId, projectId);
      // Another worker may have stored the same inputs while the model was thinking.
      const current = await repo.latestSummary(organizationId, projectId, tx);
      if (current?.fingerprint === fingerprint) return 'unchanged' as const;
      const created = await repo.createSummary(tx, {
        organizationId,
        projectId,
        content,
        basedOn,
        fingerprint,
      });
      await audit(
        {
          action: 'CREATE',
          entity: 'ProjectSummary',
          entityId: created.id,
          organizationId,
          metadata: { projectId, version: created.version },
        },
        tx,
      );
      logger.info({ projectId, version: created.version }, 'Project summary created');
      return 'created' as const;
    });
  }

  async function generateQuestions(
    payload: GenerateQuestionsPayload,
  ): Promise<GenerateQuestionsOutcome> {
    const { organizationId, projectId } = payload;
    if ((await repo.projectName(organizationId, projectId)) === null) return { status: 'skipped' };

    const items = await repo.loadItems(organizationId, projectId);
    const candidates = selectItemsForQuestions(items);
    if (candidates.length === 0) return { status: 'empty' };

    const summary = await repo.latestSummary(organizationId, projectId);
    const existing = await repo.listQuestionsForPrompt(
      organizationId,
      projectId,
      MAX_EXISTING_QUESTIONS,
    );
    const { output } = await llm.run({
      promptName: 'questions',
      cachedContext: summary?.content ? summaryContext(summary.content, items) : undefined,
      user: questionsInput(candidates, existing),
      schema: questionsLlmOutputSchema,
      outputJsonSchema: providerJsonSchema(questionsLlmOutputSchema),
      context: { organizationId, projectId },
    });

    const moduleIds = new Set(items.filter((i) => i.kind === 'module').map((i) => i.id));
    return transaction(async (tx) => {
      const keys = await repo.listQuestionKeys(organizationId, projectId, tx);
      // Only items the model was shown can be linked.
      const plan = planQuestions(output.questions, candidates, moduleIds, keys);
      const created = await repo.insertQuestions(tx, {
        organizationId,
        projectId,
        parentQuestionId: null,
        questions: plan.questions,
      });
      if (created > 0) {
        await audit(
          {
            action: 'CREATE',
            entity: 'Question',
            organizationId,
            metadata: { projectId, created, dropped: plan.dropped },
          },
          tx,
        );
      }
      logger.info({ projectId, created, dropped: plan.dropped }, 'Questions generated');
      return { status: 'generated' as const, created };
    });
  }

  async function applyAnswer(payload: ApplyAnswerPayload): Promise<ApplyAnswerOutcome> {
    const { organizationId, projectId, answerId } = payload;
    const context = await repo.findAnswerContext(organizationId, projectId, answerId);
    if (!context) return { status: 'skipped' };
    if (context.appliedAt) return { status: 'already-applied' };

    const items = await repo.loadItems(organizationId, projectId);
    const wanted = new Set(context.question.linked.map(itemKey));
    const linked = items.filter((i) => wanted.has(itemKey(i)));

    let output = NOTHING_TO_APPLY;
    if (linked.length > 0) {
      const summary = await repo.latestSummary(organizationId, projectId);
      output = (
        await llm.run({
          promptName: 'apply-answer',
          cachedContext: summary?.content ? summaryContext(summary.content, items) : undefined,
          user: applyAnswerInput(context.question, context.text, linked),
          schema: applyAnswerLlmOutputSchema,
          outputJsonSchema: providerJsonSchema(applyAnswerLlmOutputSchema),
          context: { organizationId, projectId, userId: context.answeredById },
        })
      ).output;
    }
    const plan = planAnswer(output, linked);
    const moduleIds = new Set(items.filter((i) => i.kind === 'module').map((i) => i.id));

    return transaction(async (tx) => {
      // The claim is the idempotency guard: only one run gets past it, the rest change nothing.
      if (!(await repo.claimAnswer(tx, organizationId, projectId, answerId))) {
        return { status: 'already-applied' as const };
      }

      const applied: PlannedChange[] = [];
      const conflicts = [...plan.conflicts];
      for (const change of plan.changes) {
        if (await repo.updateItem(tx, organizationId, projectId, change)) {
          applied.push(change);
          continue;
        }
        conflicts.push({
          kind: change.kind,
          id: change.id,
          title: change.before.title,
          explanation: CONFIRMED_MEANWHILE,
          moduleId: linked.find((i) => itemKey(i) === itemKey(change))?.moduleId ?? null,
        });
      }

      const keys = await repo.listQuestionKeys(organizationId, projectId, tx);
      const questions = planQuestions(
        [...plan.followUps, ...conflicts.map(conflictQuestion)],
        linked,
        moduleIds,
        keys,
      );
      const followUps = await repo.insertQuestions(tx, {
        organizationId,
        projectId,
        parentQuestionId: context.question.id,
        questions: questions.questions,
      });

      const decisionId = await repo.createDecision(tx, {
        organizationId,
        projectId,
        answerId,
        questionId: context.question.id,
        decidedById: context.answeredById,
        summary: plan.summary,
        changes: applied,
        conflicts: conflicts.map(({ kind, id, title, explanation }) => ({
          kind,
          id,
          title,
          explanation,
        })),
      });
      await audit(
        {
          action: 'CREATE',
          entity: 'Decision',
          entityId: decisionId,
          organizationId,
          metadata: {
            projectId,
            answerId,
            changed: applied.length,
            conflicts: conflicts.length,
            followUps,
          },
        },
        tx,
      );
      logger.info(
        { projectId, answerId, changed: applied.length, conflicts: conflicts.length, followUps },
        'Answer applied',
      );
      return {
        status: 'applied' as const,
        changed: applied.length,
        conflicts: conflicts.length,
        followUps,
      };
    });
  }

  return { refreshSummary, generateQuestions, applyAnswer };
}
