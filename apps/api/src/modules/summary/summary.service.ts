import { z } from 'zod';
import {
  JobName,
  summaryLlmOutputSchema,
  type LinkedItemKind,
  type SummaryContentDto,
  type SummaryDto,
  type SummaryQuery,
  type SummaryResponseDto,
  type UserDto,
} from '@brd/shared';
import { AppError, NotFoundError } from '../../errors/app-error.js';
import { logger } from '../../lib/logger.js';
import { enqueueJob } from '../../services/queue.service.js';
import * as repo from './summary.repository.js';

const basedOnSchema = z.record(z.string(), z.number());

const titleKey = (kind: LinkedItemKind, id: string): string => `${kind}:${id}`;

/**
 * The job stores ids only (so a summary never holds stale text); titles are read from the live
 * items here. An item that no longer exists is left out rather than shown without a name.
 */
export function toSummaryContent(
  stored: z.infer<typeof summaryLlmOutputSchema>,
  titles: Map<string, string>,
): SummaryContentDto {
  const withTitle = <T extends { kind: LinkedItemKind; id: string }>(item: T) => {
    const title = titles.get(titleKey(item.kind, item.id));
    return title === undefined ? [] : [{ ...item, title }];
  };

  return {
    overview: stored.overview,
    modules: stored.modules.map((m) => ({ id: m.moduleId, name: m.name, summary: m.summary })),
    keyRequirements: stored.keyRequirements.flatMap((r) =>
      withTitle({ kind: 'requirement' as const, id: r.requirementId }).map(({ id, title }) => ({
        id,
        title,
        why: r.why,
      })),
    ),
    keyRules: stored.keyRules.flatMap((r) =>
      withTitle({ kind: 'rule' as const, id: r.ruleId }).map(({ id, title }) => ({
        id,
        title,
        why: r.why,
      })),
    ),
    assumptions: stored.assumptions.flatMap((a) =>
      withTitle({ kind: a.itemKind, id: a.itemId }).map((item) => ({
        ...item,
        statement: a.statement,
      })),
    ),
    staleItems: stored.staleItems.flatMap((s) => withTitle({ kind: s.itemKind, id: s.itemId })),
  };
}

function idsOf(stored: z.infer<typeof summaryLlmOutputSchema>): repo.ItemIds {
  const of = (kind: LinkedItemKind, direct: string[]): string[] => [
    ...new Set([
      ...direct,
      ...stored.assumptions.filter((a) => a.itemKind === kind).map((a) => a.itemId),
      ...stored.staleItems.filter((s) => s.itemKind === kind).map((s) => s.itemId),
    ]),
  ];
  return {
    requirements: of(
      'requirement',
      stored.keyRequirements.map((r) => r.requirementId),
    ),
    rules: of(
      'rule',
      stored.keyRules.map((r) => r.ruleId),
    ),
    modules: of('module', []),
  };
}

async function toSummaryDto(
  user: UserDto,
  projectId: string,
  record: repo.SummaryRecord,
): Promise<SummaryDto> {
  const parsed = summaryLlmOutputSchema.safeParse(record.content);
  if (!parsed.success) {
    logger.error(
      { projectId, version: record.version },
      'Stored summary does not match its schema',
    );
    throw new AppError(500, 'INTERNAL_SERVER_ERROR', 'The summary could not be read');
  }
  const titles = await repo.findItemTitles(user.organizationId, projectId, idsOf(parsed.data));
  const basedOn = basedOnSchema.safeParse(record.basedOn);
  return {
    version: record.version,
    generatedAt: record.generatedAt.toISOString(),
    content: toSummaryContent(parsed.data, titles),
    basedOn: basedOn.success ? basedOn.data : {},
  };
}

export async function getSummary(
  user: UserDto,
  projectId: string,
  query: SummaryQuery,
): Promise<SummaryResponseDto> {
  const [versions, record] = await Promise.all([
    repo.listVersions(user.organizationId, projectId),
    repo.findSummary(user.organizationId, projectId, query.version),
  ]);

  if (!record) {
    if (query.version !== undefined) {
      throw new NotFoundError('Summary version not found');
    }
    return { summary: null, versions: [] };
  }
  return {
    summary: await toSummaryDto(user, projectId, record),
    versions: versions.map((v) => ({
      version: v.version,
      generatedAt: v.generatedAt.toISOString(),
    })),
  };
}

/** Asks the background job for a new summary. It does nothing if nothing changed since the last. */
export async function requestRefresh(
  user: UserDto,
  projectId: string,
): Promise<{ requested: true }> {
  try {
    await enqueueJob(JobName.REFRESH_SUMMARY, { organizationId: user.organizationId, projectId });
  } catch (err) {
    logger.error({ err, projectId }, 'Could not queue refresh-summary');
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Could not start the summary refresh. Try again shortly.',
    );
  }
  return { requested: true };
}
