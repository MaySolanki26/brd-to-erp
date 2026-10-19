import {
  InlineAlert,
  PageError,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@brd/ui';
import { KNOWLEDGE_STATUSES, type KnowledgeKind } from '@brd/shared';
import { errorMessage } from '@/lib/error-message';
import { useKnowledgeSummary } from '../hooks/use-knowledge';
import { STATUS_LABELS, STATUS_TONES } from '../knowledge-labels';

const KINDS: { kind: KnowledgeKind; label: string }[] = [
  { kind: 'requirements', label: 'Requirements' },
  { kind: 'rules', label: 'Rules' },
  { kind: 'modules', label: 'Modules' },
];

export function KnowledgeCountsPanel({ projectId }: { projectId: string }) {
  const query = useKnowledgeSummary(projectId);

  return (
    <section aria-labelledby="knowledge-heading" className="uab-panel flex flex-col gap-3">
      <h2 id="knowledge-heading" className="uab-panel-title">
        What was found
      </h2>
      {query.isPending && <Skeleton className="h-32 w-full max-w-3xl" />}
      {query.isError && (
        <PageError
          message="Could not load the counts"
          description={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.isSuccess && (
        <div className="max-w-3xl space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                {KNOWLEDGE_STATUSES.map((status) => (
                  <TableHead key={status} className="text-right">
                    <StatusBadge label={STATUS_LABELS[status]} tone={STATUS_TONES[status]} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {KINDS.map(({ kind, label }) => (
                <TableRow key={kind}>
                  <TableCell className="font-medium">{label}</TableCell>
                  {KNOWLEDGE_STATUSES.map((status) => (
                    <TableCell key={status} className="text-right tabular-nums">
                      {query.data.counts[kind][status]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {query.data.chunksNeedingReview > 0 && (
            <InlineAlert tone="warning">
              {query.data.chunksNeedingReview} part
              {query.data.chunksNeedingReview === 1 ? '' : 's'} of your sources could not be read
              cleanly. Items taken from them are marked for review.
            </InlineAlert>
          )}
        </div>
      )}
    </section>
  );
}
