import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { SelectMenu, Button, EmptyState, NoAccess, PageError, Skeleton, toast } from '@brd/ui';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { formatDateTime } from '@/features/decisions/format';
import { useRequestSummary, useSummary } from '../hooks/use-summary';
import { SummaryContent } from './SummaryContent';

const POLL_MS = 3000;
const GIVE_UP_MS = 90_000;

interface SummaryPanelProps {
  projectId: string;
  canRefresh: boolean;
}

export function SummaryPanel({ projectId, canRefresh }: SummaryPanelProps) {
  const [selected, setSelected] = useState<number | null>(null);
  /** The newest version when a refresh was requested; set while we wait for a newer one. */
  const [waitingFrom, setWaitingFrom] = useState<number | null>(null);
  const request = useRequestSummary(projectId);
  const query = useSummary(projectId, selected, waitingFrom === null ? false : POLL_MS);

  const versions = query.data?.versions ?? [];
  const latest = versions[0]?.version ?? 0;

  useEffect(() => {
    if (waitingFrom !== null && latest > waitingFrom) {
      setWaitingFrom(null);
      setSelected(null);
      toast.success('The summary was updated.');
    }
  }, [latest, waitingFrom]);

  useEffect(() => {
    if (waitingFrom === null) return;
    const timer = window.setTimeout(() => {
      setWaitingFrom(null);
      toast.info('The summary is taking longer than usual. It will appear here when it is ready.');
    }, GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [waitingFrom]);

  const refresh = () => request.mutate(undefined, { onSuccess: () => setWaitingFrom(latest) });

  if (query.isError && isForbidden(query.error)) {
    return <NoAccess description="You do not have access to this project's summary." />;
  }

  const summary = query.data?.summary ?? null;
  const viewingOlder = summary !== null && summary.version !== latest;
  const waiting = waitingFrom !== null;

  return (
    <section aria-label="Project summary" className="uab-panel flex flex-col gap-4">
      <div className="uab-panel-head flex-wrap">
        <h3 className="uab-panel-title">Project summary</h3>
        <div className="flex flex-wrap items-center gap-2">
          {versions.length > 0 && (
            <SelectMenu
              label="Summary version"
              value={String(summary?.version ?? latest)}
              options={versions.map((version) => ({
                value: String(version.version),
                label: `Version ${version.version} · ${formatDateTime(version.generatedAt)}`,
              }))}
              onChange={(next) => setSelected(Number(next) === latest ? null : Number(next))}
            />
          )}
          {canRefresh && summary !== null && (
            <Button
              icon={waiting ? undefined : 'reset'}
              loading={waiting}
              disabled={request.isPending}
              onClick={refresh}
            >
              {waiting ? 'Updating…' : 'Refresh summary'}
            </Button>
          )}
        </div>
      </div>

      {viewingOlder && (
        <p className="flex flex-wrap items-center gap-2 uab-muted">
          Viewing version {summary.version} of {latest}.
          <Button variant="link" onClick={() => setSelected(null)}>
            Show latest
          </Button>
        </p>
      )}

      {query.isPending && (
        <div className="space-y-2" aria-label="Loading the summary">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      )}
      {query.isError && (
        <PageError
          message="Could not load the summary"
          description={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.isSuccess && summary === null && (
        <EmptyState
          icon={FileText}
          title="No summary yet"
          description={
            canRefresh
              ? 'Generate one once requirements have been extracted from your sources.'
              : 'A summary appears here once the project has been analysed.'
          }
          action={
            canRefresh ? (
              <Button size="sm" disabled={request.isPending || waiting} onClick={refresh}>
                {waiting ? 'Generating…' : 'Generate summary'}
              </Button>
            ) : undefined
          }
        />
      )}
      {summary && <SummaryContent summary={summary} />}
    </section>
  );
}
