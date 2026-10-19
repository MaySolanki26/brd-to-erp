import { useState } from 'react';
import { FileX } from 'lucide-react';
import { SelectMenu, Button, EmptyState, FormDrawer, PageError, PageLoader } from '@brd/ui';
import { errorMessage } from '@/lib/error-message';
import { CHUNK_PAGE_SIZE, useDocumentDetail } from '../hooks/use-sources';
import { formatDate } from '../project-labels';
import { formatBytes } from '../source-utils';
import { SourceStatusBadge } from './SourceStatusBadge';

interface DocumentDrawerProps {
  projectId: string;
  documentId: string | null;
  /** Start on this version instead of the latest. */
  initialVersionId?: string | null;
  onClose: () => void;
}

export function DocumentDrawer({
  projectId,
  documentId,
  initialVersionId = null,
  onClose,
}: DocumentDrawerProps) {
  const [versionId, setVersionId] = useState<string | null>(initialVersionId);
  const [page, setPage] = useState(1);
  const detail = useDocumentDetail(projectId, documentId, versionId, page);
  const document = detail.data;
  const pageCount = document ? Math.max(1, Math.ceil(document.chunks.total / CHUNK_PAGE_SIZE)) : 1;

  const selectVersion = (next: string) => {
    setVersionId(next);
    setPage(1);
  };

  return (
    <FormDrawer
      open={documentId !== null}
      onOpenChange={(open) => !open && onClose()}
      title={document?.title ?? 'Document'}
      description={
        document
          ? `${formatBytes(document.latestVersion.sizeBytes)} · uploaded ${formatDate(document.createdAt)}`
          : undefined
      }
    >
      {detail.isPending && <PageLoader />}
      {detail.isError && (
        <PageError
          message="Could not load the document"
          description={errorMessage(detail.error)}
          onRetry={() => void detail.refetch()}
        />
      )}
      {document && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SourceStatusBadge status={document.status} />
            {document.versions.length > 1 && (
              <SelectMenu
                label="Version"
                value={document.chunksVersionId}
                options={document.versions.map((version) => ({
                  value: version.id,
                  label: `Version ${version.versionNumber}`,
                }))}
                onChange={selectVersion}
              />
            )}
            <span className="text-sm text-muted-foreground">
              {document.chunks.total} chunk{document.chunks.total === 1 ? '' : 's'}
            </span>
          </div>

          {document.failureReason && (
            <p role="alert" className="text-sm text-destructive">
              {document.failureReason}
            </p>
          )}

          {document.chunks.items.length === 0 ? (
            <EmptyState
              icon={FileX}
              title="No chunks for this version"
              description={
                document.status === 'PROCESSED'
                  ? 'No text was extracted.'
                  : 'Chunks appear once processing finishes.'
              }
            />
          ) : (
            <ol className="space-y-3">
              {document.chunks.items.map((chunk) => (
                <li key={chunk.id} className="rounded-md border border-border p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    #{chunk.chunkIndex + 1}
                    {chunk.headingPath.length > 0 && ` · ${chunk.headingPath.join(' › ')}`}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{chunk.content}</p>
                </li>
              ))}
            </ol>
          )}

          {pageCount > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </FormDrawer>
  );
}
