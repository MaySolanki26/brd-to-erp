import { useMemo } from 'react';
import { History } from 'lucide-react';
import { Button, CardListSkeleton, EmptyState, NoAccess, PageError } from '@brd/ui';
import { errorMessage, isForbidden } from '@/lib/error-message';
import { useDecisions } from '../hooks/use-decisions';
import { DecisionCard } from './DecisionCard';

export function DecisionsTab({ projectId }: { projectId: string }) {
  const decisions = useDecisions(projectId);
  const items = useMemo(
    () => decisions.data?.pages.flatMap((page) => page.items) ?? [],
    [decisions.data],
  );

  if (decisions.isError && isForbidden(decisions.error)) {
    return <NoAccess description="You do not have access to this project's decisions." />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Decisions</h2>

      {decisions.isPending && <CardListSkeleton rows={3} />}
      {decisions.isError && (
        <PageError
          message="Could not load decisions"
          description={errorMessage(decisions.error)}
          onRetry={() => void decisions.refetch()}
        />
      )}
      {decisions.isSuccess && items.length === 0 && (
        <EmptyState
          icon={History}
          title="No decisions yet"
          description="When a question is answered, the decision and what it changed are recorded here."
        />
      )}
      {decisions.isSuccess && items.length > 0 && (
        <>
          <ol aria-label="Decision timeline" className="border-l border-border pl-3">
            {items.map((decision) => (
              <DecisionCard key={decision.id} decision={decision} />
            ))}
          </ol>
          {decisions.hasNextPage && (
            <Button
              variant="outline"
              disabled={decisions.isFetchingNextPage}
              onClick={() => void decisions.fetchNextPage()}
            >
              {decisions.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
