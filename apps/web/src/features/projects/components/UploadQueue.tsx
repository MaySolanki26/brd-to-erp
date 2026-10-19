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
  if (status === 'done') return <CheckCircle2 size={16} className="uab-text-success" aria-hidden />;
  if (status === 'failed' || status === 'rejected') {
    return <CircleAlert size={16} className="uab-text-danger" aria-hidden />;
  }
  if (status === 'canceled') return <CircleSlash size={16} className="uab-muted" aria-hidden />;
  return <Loader2 size={16} className="uab-muted animate-spin" aria-hidden />;
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
    <section aria-label="Uploads" className="uab-panel">
      <div className="uab-panel-head">
        <h3 className="uab-panel-title">Uploads</h3>
        {hasFinished && (
          <Button variant="ghost" onClick={onClearFinished}>
            Clear finished
          </Button>
        )}
      </div>
      <ul className="grid gap-2" aria-live="polite">
        {items.map((item) => {
          const showProgress = item.status === 'uploading' || item.status === 'confirming';
          const failed = item.status === 'failed' || item.status === 'rejected';
          return (
            <li key={item.id} className="uab-upload-row">
              <div className="uab-upload-line">
                <StatusIcon status={item.status} />
                <div className="uab-upload-main">
                  <p className="uab-upload-name">
                    {item.fileName}
                    <span className="uab-muted">
                      {formatBytes(item.size)}
                      {item.documentName && ` · new version of ${item.documentName}`}
                    </span>
                  </p>
                  <p
                    className={failed ? 'uab-text-danger' : 'uab-muted'}
                    role={failed ? 'alert' : undefined}
                  >
                    {statusText(item)}
                  </p>
                </div>
                {(item.status === 'queued' || item.status === 'uploading') && (
                  <Button
                    aria-label={`Cancel upload of ${item.fileName}`}
                    onClick={() => onCancel(item.id)}
                  >
                    Cancel
                  </Button>
                )}
                {(item.status === 'failed' || item.status === 'canceled') && (
                  <Button
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
                    <X size={14} aria-hidden />
                  </Button>
                )}
              </div>
              {showProgress && (
                <Progress
                  value={item.progress}
                  // The shared Progress draws the bar from `value` but does not expose it to assistive tech.
                  aria-valuenow={item.progress}
                  aria-label={`Upload progress for ${item.fileName}`}
                />
              )}
              {item.status === 'done' && item.duplicateOf && (
                <p className="uab-inline-alert uab-tone-warning">
                  Identical content already exists in &ldquo;{item.duplicateOf.title}&rdquo;.
                  <Button
                    variant="link"
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
