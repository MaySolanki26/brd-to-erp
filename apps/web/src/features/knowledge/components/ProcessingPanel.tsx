import { Clock } from 'lucide-react';
import { EmptyState, PageError, Progress, Skeleton } from '@brd/ui';
import type { ChunkProgressDto, ProcessingStatusDto, SourceStatus } from '@brd/shared';
import { errorMessage } from '@/lib/error-message';
import { useProcessingStatus } from '@/features/projects/hooks/use-sources';
import { SourceStatusBadge } from '@/features/projects/components/SourceStatusBadge';

const ORDER: SourceStatus[] = ['UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED'];

function totalSources(status: ProcessingStatusDto): number {
  return ORDER.reduce((sum, key) => sum + status.counts[key], 0);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProcessingPanel({ projectId }: { projectId: string }) {
  const query = useProcessingStatus(projectId);

  return (
    <section aria-labelledby="processing-heading" className="space-y-3">
      <h2 id="processing-heading" className="text-base font-semibold">
        Processing
      </h2>
      {query.isPending && <Skeleton className="h-16 w-full max-w-xl" />}
      {query.isError && (
        <PageError
          message="Could not load processing status"
          description={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.isSuccess && totalSources(query.data) === 0 && (
        <EmptyState
          icon={Clock}
          title="No sources yet"
          description="Add a document or a note in the Sources tab to start."
        />
      )}
      {query.isSuccess && totalSources(query.data) > 0 && (
        <div className="max-w-xl space-y-3">
          <ProgressBar status={query.data} />
          <PartsRead chunks={query.data.chunks} />
          <ul className="flex flex-wrap gap-3">
            {ORDER.map((key) => (
              <li key={key} className="flex items-center gap-1.5 text-sm">
                <SourceStatusBadge status={key} />
                <span>{query.data.counts[key]}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            {query.data.lastProcessedAt
              ? `Last processed ${formatDateTime(query.data.lastProcessedAt)}`
              : 'Nothing has finished processing yet.'}
          </p>
        </div>
      )}
    </section>
  );
}

function ProgressBar({ status }: { status: ProcessingStatusDto }) {
  const total = totalSources(status);
  // Failed sources are finished too; they are shown separately so they are not hidden in the bar.
  const done = status.counts.PROCESSED;
  const percent = Math.round((done / total) * 100);
  return (
    <div className="space-y-1">
      <Progress value={percent} aria-label="Sources processed" />
      <p className="text-sm">
        {done} of {total} sources processed{status.active && ' · working…'}
      </p>
    </div>
  );
}

/** Sources are cut into parts that are read one by one, which is where most of the waiting is. */
function PartsRead({ chunks }: { chunks: ChunkProgressDto }) {
  if (chunks.total === 0) return null;
  const percent = Math.round((chunks.extracted / chunks.total) * 100);
  return (
    <div className="space-y-1">
      <Progress value={percent} aria-label="Parts read" />
      <p className="text-sm">
        {chunks.extracted} of {chunks.total} parts read
        {chunks.needingReview > 0 &&
          ` · ${String(chunks.needingReview)} need${chunks.needingReview === 1 ? 's' : ''} a person to check`}
      </p>
    </div>
  );
}
