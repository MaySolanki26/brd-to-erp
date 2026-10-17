import { createHash } from 'node:crypto';
import type { OpenQuestion, ReportItem, SourceVersions } from './report.types.js';

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

const ORDER = { module: 0, requirement: 1, rule: 2 } as const;

/** Stable order, so the same items always give the same hash. */
function sorted(items: ReportItem[]): ReportItem[] {
  return [...items].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.id.localeCompare(b.id));
}

/**
 * Identifies what the project knows right now: every item, its status and its wording. A report
 * version remembers the value from when it was written, an approval the value from when it was
 * decided; a different value later means the project moved on.
 */
export function fingerprintItems(items: ReportItem[]): string {
  return sha256(
    sorted(items)
      .map((i) => [i.kind, i.id, i.status, i.title, i.description ?? ''].join('|'))
      .join('\n'),
  );
}

export interface Baseline {
  snapshot: Record<string, unknown>;
  /** SHA-256 of the whole snapshot. */
  hash: string;
  /** Fingerprint of the items alone. */
  fingerprint: string;
}

/** Everything an approval is made against: all items, the source versions and the summary version. */
export function buildBaseline(input: {
  takenAt: Date;
  summaryVersion: number | null;
  items: ReportItem[];
  sources: SourceVersions;
  openQuestions: { total: number; critical: number };
}): Baseline {
  const snapshot = {
    takenAt: input.takenAt.toISOString(),
    summaryVersion: input.summaryVersion,
    items: sorted(input.items).map((i) => ({
      kind: i.kind,
      id: i.id,
      status: i.status,
      title: i.title,
      description: i.description,
      moduleId: i.moduleId,
      sourceChunkId: i.sourceChunkId,
    })),
    sources: input.sources,
    openQuestions: input.openQuestions,
  };
  return {
    snapshot,
    hash: sha256(JSON.stringify(snapshot)),
    fingerprint: fingerprintItems(input.items),
  };
}

export function countCritical(questions: Pick<OpenQuestion, 'priority'>[]): number {
  return questions.filter((q) => q.priority === 'CRITICAL').length;
}
