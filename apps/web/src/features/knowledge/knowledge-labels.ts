import { ATTENTION_STATUSES, type KnowledgeSourceDto, type KnowledgeStatus } from '@brd/shared';

export const STATUS_LABELS: Record<KnowledgeStatus, string> = {
  CONFIRMED: 'Confirmed',
  ASSUMED: 'Assumed',
  OPEN: 'Open',
  REJECTED: 'Rejected',
  NEEDS_REVALIDATION: 'Needs revalidation',
};

export const STATUS_TONES: Record<
  KnowledgeStatus,
  'success' | 'info' | 'neutral' | 'danger' | 'warning'
> = {
  CONFIRMED: 'success',
  ASSUMED: 'info',
  OPEN: 'neutral',
  REJECTED: 'danger',
  NEEDS_REVALIDATION: 'warning',
};

/** An item asks for a second look when it must be revalidated or its source text was unclear. */
export function needsAttention(item: { status: KnowledgeStatus; source: KnowledgeSourceDto }) {
  return ATTENTION_STATUSES.includes(item.status) || item.source.needsReview;
}

export function sourceLabel(source: KnowledgeSourceDto): string {
  const version = source.versionNumber === null ? '' : ` v${String(source.versionNumber)}`;
  return `${source.sourceTitle}${version}`;
}
