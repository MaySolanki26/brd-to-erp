import { CheckCircle2, CircleAlert, CircleSlash, Loader2, X } from 'lucide-react';
import { Button, Progress } from '@brd/ui';
import { isFinished, type UploadItem } from '../hooks/use-upload-queue';
import { formatBytes } from '../source-utils';

interface UploadQueueProps {
  items: UploadItem[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
  onClearFinished: () => void;
  onOpenDocument: (documentId: string) => void;
}

function statusText(item: UploadItem): string {
  switch (item.status) {
    case 'queued':
      return 'Waiting to upload';
    case 'uploading':
      return `Uploading ${String(item.progress)}%`;
    case 'confirming':
      return 'Saving…';
    case 'done':
      return 'Uploaded. Processing will start shortly.';
    case 'canceled':
      return 'Canceled';
    case 'failed':
    case 'rejected':
      return item.error ?? 'Upload failed';
  }
}

function StatusIcon({ status }: { status: UploadItem['status'] }) {
  const base = 'h-4 w-4 shrink-0';
  if (status === 'done') return <CheckCircle2 className={`${base} text-success`} aria-hidden />;
  if (status === 'failed' || status === 'rejected') {
    return <CircleAlert className={`${base} text-destructive`} aria-hidden />;
  }
  if (status === 'canceled')
    return <CircleSlash className={`${base} text-muted-foreground`} aria-hidden />;
  return <Loader2 className={`${base} animate-spin text-muted-foreground`} aria-hidden />;
}

export function UploadQueue({
  items,
  onCancel,
  onRetry,
  onDismiss,
  onClearFinished,
  onOpenDocument,
}: UploadQueueProps) {
  if (items.length === 0) return null;

  const hasFinished = items.some((item) => isFinished(item.status) && item.status !== 'failed');

  return (
    <section aria-label="Uploads" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Uploads</h3>
        {hasFinished && (
          <Button variant="ghost" size="sm" onClick={onClearFinished}>
            Clear finished
          </Button>
        )}
      </div>
      <ul className="space-y-2" aria-live="polite">
        {items.map((item) => {
          const showProgress = item.status === 'uploading' || item.status === 'confirming';
          const failed = item.status === 'failed' || item.status === 'rejected';
          return (
            <li key={item.id} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-3">
                <StatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.fileName}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {formatBytes(item.size)}
                      {item.documentName && ` · new version of ${item.documentName}`}
                    </span>
                  </p>
                  <p
                    className={
                      failed ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'
                    }
                    role={failed ? 'alert' : undefined}
                  >
                    {statusText(item)}
                  </p>
                </div>
                {(item.status === 'queued' || item.status === 'uploading') && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Cancel upload of ${item.fileName}`}
                    onClick={() => onCancel(item.id)}
                  >
                    Cancel
                  </Button>
                )}
                {(item.status === 'failed' || item.status === 'canceled') && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Retry upload of ${item.fileName}`}
                    onClick={() => onRetry(item.id)}
                  >
                    Retry
                  </Button>
                )}
                {isFinished(item.status) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Dismiss ${item.fileName}`}
                    onClick={() => onDismiss(item.id)}
                  >
                    <X />
                  </Button>
                )}
              </div>
              {showProgress && (
                <Progress
                  value={item.progress}
                  // The shared Progress draws the bar from `value` but does not expose it to assistive tech.
                  aria-valuenow={item.progress}
                  className="mt-2 h-1.5"
                  aria-label={`Upload progress for ${item.fileName}`}
                />
              )}
              {item.status === 'done' && item.duplicateOf && (
                <p className="mt-2 flex flex-wrap items-center gap-2 rounded bg-warning/10 px-2 py-1 text-xs text-warning-foreground">
                  Identical content already exists in &ldquo;{item.duplicateOf.title}&rdquo;.
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => item.duplicateOf && onOpenDocument(item.duplicateOf.documentId)}
                  >
                    View original
                  </Button>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
