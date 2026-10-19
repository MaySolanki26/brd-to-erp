import { RefreshCw } from 'lucide-react';
import { Button } from '@brd/ui';

interface ConflictNoticeProps {
  message: string;
  refreshing: boolean;
  onRefresh: () => void;
}

/** Shown when someone else changed the question first (HTTP 409). The draft is not lost. */
export function ConflictNotice({ message, refreshing, onRefresh }: ConflictNoticeProps) {
  return (
    <div
      role="alert"
      className="uab-inline-alert uab-tone-warning flex flex-wrap items-center justify-between gap-2"
    >
      <div>
        <p className="font-medium">{message}</p>
        <p className="text-muted-foreground">Your text is kept below. Refresh to see the latest.</p>
      </div>
      <Button variant="outline" size="sm" disabled={refreshing} onClick={onRefresh}>
        <RefreshCw className="mr-1 h-3 w-3" />
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </Button>
    </div>
  );
}
