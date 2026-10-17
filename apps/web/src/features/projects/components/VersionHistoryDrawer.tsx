import { Badge, Button, FormDrawer, PageError, PageLoader } from '@brd/ui';
import { apiUrl } from '@/lib/api-client';
import { errorMessage } from '@/lib/error-message';
import { useDocumentDetail } from '../hooks/use-sources';
import { formatDate } from '../project-labels';
import { formatBytes, shortHash } from '../source-utils';

interface VersionHistoryDrawerProps {
  projectId: string;
  documentId: string | null;
  onClose: () => void;
  onViewChunks: (documentId: string, versionId: string) => void;
}

export function VersionHistoryDrawer({
  projectId,
  documentId,
  onClose,
  onViewChunks,
}: VersionHistoryDrawerProps) {
  const detail = useDocumentDetail(projectId, documentId, null, 1);
  const document = detail.data;

  return (
    <FormDrawer
      open={documentId !== null}
      onOpenChange={(open) => !open && onClose()}
      title={document ? `Version history: ${document.title}` : 'Version history'}
      description="Every version ever uploaded for this document, newest first."
      size="lg"
    >
      {detail.isPending && <PageLoader />}
      {detail.isError && (
        <PageError
          message="Could not load versions"
          description={errorMessage(detail.error)}
          onRetry={() => void detail.refetch()}
        />
      )}
      {document && (
        <div className="space-y-3">
          {document.versions.length === 1 && (
            <p className="text-sm text-muted-foreground">
              This is the only version. Upload a new version to see history here.
            </p>
          )}
          <ol className="space-y-3">
            {document.versions.map((version, index) => (
              <li key={version.id} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Version {version.versionNumber}</span>
                  {index === 0 && <Badge>Current</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {version.createdBy.name} · {formatDate(version.createdAt)} ·{' '}
                  {formatBytes(version.sizeBytes)} · hash {shortHash(version.contentHash)}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={apiUrl(
                        `/projects/${projectId}/documents/${document.id}/versions/${version.id}/download`,
                      )}
                      download
                      aria-label={`Download version ${String(version.versionNumber)}`}
                    >
                      Download
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`View chunks of version ${String(version.versionNumber)}`}
                    onClick={() => onViewChunks(document.id, version.id)}
                  >
                    View chunks
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </FormDrawer>
  );
}
