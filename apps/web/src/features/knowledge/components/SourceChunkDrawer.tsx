import { AlertTriangle, FileX } from 'lucide-react';
import { EmptyState, FormDrawer, PageError, PageLoader } from '@brd/ui';
import { ApiClientError } from '@/lib/api-client';
import { errorMessage } from '@/lib/error-message';
import { useChunk } from '../hooks/use-chunk';

interface SourceChunkDrawerProps {
  projectId: string;
  chunkId: string | null;
  onClose: () => void;
}

/** Shows the exact text an item was taken from, with where it sits in the source. */
export function SourceChunkDrawer({ projectId, chunkId, onClose }: SourceChunkDrawerProps) {
  const chunk = useChunk(projectId, chunkId);
  const data = chunk.data;
  const missing = chunk.error instanceof ApiClientError && chunk.error.status === 404;

  const description = data
    ? `${data.source.type === 'document' ? 'Document' : 'Note'}${
        data.source.versionNumber === null ? '' : ` · version ${String(data.source.versionNumber)}`
      } · section ${String(data.chunkIndex + 1)}`
    : undefined;

  return (
    <FormDrawer
      open={chunkId !== null}
      onOpenChange={(open) => !open && onClose()}
      title={data?.source.sourceTitle ?? 'Source'}
      description={description}
      size="xl"
    >
      {chunk.isPending && chunkId !== null && <PageLoader />}
      {chunk.isError &&
        (missing ? (
          <EmptyState
            icon={FileX}
            title="Source not available"
            description="This part of the source no longer exists, or you do not have access to it."
          />
        ) : (
          <PageError
            message="Could not load the source"
            description={errorMessage(chunk.error)}
            onRetry={() => void chunk.refetch()}
          />
        ))}
      {data && (
        <div className="space-y-4">
          {data.headingPath.length > 0 && (
            <nav aria-label="Location in the source" className="text-sm text-muted-foreground">
              {data.headingPath.join(' › ')}
            </nav>
          )}
          {data.needsReview && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              This text could not be read cleanly, so items taken from it need a person to check
              them.
            </p>
          )}
          <blockquote className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-sm">
            {data.content}
          </blockquote>
        </div>
      )}
    </FormDrawer>
  );
}
