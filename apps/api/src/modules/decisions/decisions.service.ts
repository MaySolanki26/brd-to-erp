import {
  decisionChangeRecordSchema,
  decisionConflictRecordSchema,
  type DecisionChangeDto,
  type DecisionConflictDto,
  type DecisionDto,
  type ListDecisionsQuery,
  type PagedResult,
  type UserDto,
} from '@brd/shared';
import { logger } from '../../lib/logger.js';
import * as repo from './decisions.repository.js';

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Keeps the entries that match the stored shape; one odd entry never hides the whole decision. */
function toChanges(value: unknown): { items: DecisionChangeDto[]; dropped: number } {
  const entries = asArray(value);
  const items = entries.flatMap((entry): DecisionChangeDto[] => {
    const parsed = decisionChangeRecordSchema.safeParse(entry);
    if (!parsed.success) return [];
    const { kind, id, before, after, reason } = parsed.data;
    return [{ kind, id, title: after.title, before, after, reason: reason ?? null }];
  });
  return { items, dropped: entries.length - items.length };
}

function toConflicts(value: unknown): { items: DecisionConflictDto[]; dropped: number } {
  const entries = asArray(value);
  const items = entries.flatMap((entry): DecisionConflictDto[] => {
    const parsed = decisionConflictRecordSchema.safeParse(entry);
    if (!parsed.success) return [];
    const { kind, id, title, explanation } = parsed.data;
    return [{ kind, id, title: title ?? null, explanation }];
  });
  return { items, dropped: entries.length - items.length };
}

export function toDecisionDto(record: repo.DecisionRecord): DecisionDto {
  const changes = toChanges(record.changes);
  const conflicts = toConflicts(record.conflicts);
  if (changes.dropped + conflicts.dropped > 0) {
    logger.warn(
      { decisionId: record.id, dropped: changes.dropped + conflicts.dropped },
      'Decision entries did not match the expected shape',
    );
  }
  return {
    id: record.id,
    question: { id: record.question.id, text: record.question.content },
    answer: record.answer.content,
    summary: record.summary,
    decidedBy: record.decidedBy,
    decidedAt: record.createdAt.toISOString(),
    changes: changes.items,
    conflicts: conflicts.items,
  };
}

export async function listDecisions(
  user: UserDto,
  projectId: string,
  query: ListDecisionsQuery,
): Promise<PagedResult<DecisionDto>> {
  const { items, total } = await repo.listDecisions({
    organizationId: user.organizationId,
    projectId,
    page: query.page,
    pageSize: query.pageSize,
  });
  return { items: items.map(toDecisionDto), page: query.page, pageSize: query.pageSize, total };
}
