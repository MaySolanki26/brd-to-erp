import {
  JobName,
  QUESTION_PRIORITIES,
  QUESTION_STATUSES,
  type AnswerQuestionInput,
  type DismissQuestionInput,
  type LinkedItemDto,
  type ListQuestionsQuery,
  type QuestionCountsDto,
  type QuestionDto,
  type QuestionListDto,
  type QuestionModuleCountDto,
  type QuestionPriority,
  type UserDto,
} from '@brd/shared';
import { AppError, ConflictError, NotFoundError } from '../../errors/app-error.js';
import { logger } from '../../lib/logger.js';
import { withTransaction, type DbClient } from '../../lib/transaction.js';
import { enqueueJob } from '../../services/queue.service.js';
import { createAuditLog } from '../audit/audit.repository.js';
import { toSource } from '../knowledge/knowledge-source.js';
import * as repo from './questions.repository.js';

function linkedItems(question: repo.QuestionRecord): LinkedItemDto[] {
  return question.links.flatMap(({ requirement, rule, module }): LinkedItemDto[] => {
    if (requirement) {
      const { sourceChunk, ...item } = requirement;
      return [{ kind: 'requirement', ...item, source: toSource(sourceChunk) }];
    }
    if (rule) {
      const { sourceChunk, ...item } = rule;
      return [{ kind: 'rule', ...item, source: toSource(sourceChunk) }];
    }
    if (module) {
      return [
        {
          kind: 'module',
          id: module.id,
          title: module.name,
          status: module.status,
          source: toSource(module.sourceChunk),
        },
      ];
    }
    return [];
  });
}

export function toQuestionDto(question: repo.QuestionRecord): QuestionDto {
  const answer = question.status === 'ANSWERED' ? (question.answers[0] ?? null) : null;
  return {
    id: question.id,
    text: question.content,
    reason: question.reason,
    priority: question.priority,
    status: question.status,
    version: question.version,
    module: question.module,
    linkedItems: linkedItems(question),
    answer: answer && {
      id: answer.id,
      text: answer.content,
      answeredBy: answer.answeredBy,
      answeredAt: answer.createdAt.toISOString(),
      applied: answer.appliedAt !== null,
    },
    dismissal:
      question.status === 'DISMISSED' && question.dismissReason !== null
        ? {
            reason: question.dismissReason,
            at: (question.dismissedAt ?? question.updatedAt).toISOString(),
          }
        : null,
    followUpOf: question.parentQuestionId,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}

/** One entry per module (or none) with its total and its most urgent priority. */
export function foldModuleCounts(rows: repo.ModuleCountRow[]): QuestionModuleCountDto[] {
  const byModule = new Map<string | null, { total: number; mostUrgent: QuestionPriority }>();
  for (const row of rows) {
    const entry = byModule.get(row.moduleId);
    if (!entry) {
      byModule.set(row.moduleId, { total: row.count, mostUrgent: row.priority });
      continue;
    }
    entry.total += row.count;
    if (QUESTION_PRIORITIES.indexOf(row.priority) < QUESTION_PRIORITIES.indexOf(entry.mostUrgent)) {
      entry.mostUrgent = row.priority;
    }
  }
  return [...byModule].map(([moduleId, entry]) => ({ moduleId, ...entry }));
}

export async function listQuestions(
  user: UserDto,
  projectId: string,
  query: ListQuestionsQuery,
): Promise<QuestionListDto> {
  const { items, total, moduleCounts } = await repo.listQuestions({
    organizationId: user.organizationId,
    projectId,
    status: query.status,
    reason: query.reason,
    priority: query.priority,
    moduleId: query.moduleId,
    page: query.page,
    pageSize: query.pageSize,
  });
  return {
    items: items.map(toQuestionDto),
    page: query.page,
    pageSize: query.pageSize,
    total,
    moduleCounts: foldModuleCounts(moduleCounts),
  };
}

export async function getCounts(user: UserDto, projectId: string): Promise<QuestionCountsDto> {
  const [statuses, priorities] = await Promise.all([
    repo.countByStatus(user.organizationId, projectId),
    repo.countOpenByPriority(user.organizationId, projectId),
  ]);
  const byStatus = Object.fromEntries(QUESTION_STATUSES.map((s) => [s, 0])) as Record<
    (typeof QUESTION_STATUSES)[number],
    number
  >;
  const openByPriority = Object.fromEntries(QUESTION_PRIORITIES.map((p) => [p, 0])) as Record<
    (typeof QUESTION_PRIORITIES)[number],
    number
  >;
  for (const { status, count } of statuses) byStatus[status] = count;
  for (const { priority, count } of priorities) openByPriority[priority] = count;
  return { byStatus, openByPriority, openCritical: openByPriority.CRITICAL };
}

/** Explains why a write lost: gone, already resolved by someone, or changed under the caller. */
async function lostRace(
  user: UserDto,
  projectId: string,
  questionId: string,
  db: DbClient,
): Promise<AppError> {
  const state = await repo.findConflictState(user.organizationId, projectId, questionId, db);
  if (!state) return new NotFoundError('Question not found');

  const refresh = 'Refresh to see the latest.';
  if (state.status === 'ANSWERED') {
    const by = state.answers[0]?.answeredBy.name;
    return new ConflictError(
      `This question was already answered${by ? ` by ${by}` : ''}. ${refresh}`,
    );
  }
  if (state.status === 'DISMISSED') {
    const by = state.dismissedBy?.name;
    return new ConflictError(
      `This question was already dismissed${by ? ` by ${by}` : ''}. ${refresh}`,
    );
  }
  return new ConflictError(`This question changed after you opened it. ${refresh}`);
}

async function reload(user: UserDto, projectId: string, questionId: string): Promise<QuestionDto> {
  const question = await repo.findQuestion(user.organizationId, projectId, questionId);
  if (!question) {
    throw new NotFoundError('Question not found');
  }
  return toQuestionDto(question);
}

/**
 * Records an answer. The question moves to ANSWERED only for the caller who still holds the
 * current version; everyone else gets a 409. Applying the answer to the linked items is a
 * background job, queued after the transaction commits.
 */
export async function answerQuestion(
  user: UserDto,
  projectId: string,
  questionId: string,
  input: AnswerQuestionInput,
): Promise<QuestionDto> {
  const answerId = await withTransaction(async (tx) => {
    const claim = {
      organizationId: user.organizationId,
      projectId,
      questionId,
      version: input.version,
    };
    if (!(await repo.claimForAnswer(claim, tx))) {
      throw await lostRace(user, projectId, questionId, tx);
    }
    const answer = await repo.createAnswer(
      {
        content: input.answer,
        questionId,
        answeredById: user.id,
        projectId,
        organizationId: user.organizationId,
      },
      tx,
    );
    await createAuditLog(
      {
        action: 'UPDATE',
        entity: 'Question',
        entityId: questionId,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { projectId, change: 'answered', answerId: answer.id },
      },
      tx,
    );
    return answer.id;
  });

  try {
    await enqueueJob(JobName.APPLY_ANSWER, {
      organizationId: user.organizationId,
      projectId,
      answerId,
    });
  } catch (err) {
    // The answer is saved; the job can be queued again, so this must not fail the request.
    logger.error({ err, answerId, projectId }, 'Could not queue apply-answer');
  }
  return reload(user, projectId, questionId);
}

export async function dismissQuestion(
  user: UserDto,
  projectId: string,
  questionId: string,
  input: DismissQuestionInput,
): Promise<QuestionDto> {
  await withTransaction(async (tx) => {
    const claimed = await repo.claimForDismissal(
      {
        organizationId: user.organizationId,
        projectId,
        questionId,
        version: input.version,
        reason: input.reason,
        dismissedById: user.id,
        dismissedAt: new Date(),
      },
      tx,
    );
    if (!claimed) {
      throw await lostRace(user, projectId, questionId, tx);
    }
    await createAuditLog(
      {
        action: 'UPDATE',
        entity: 'Question',
        entityId: questionId,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { projectId, change: 'dismissed' },
      },
      tx,
    );
  });
  return reload(user, projectId, questionId);
}
