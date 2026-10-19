import { CircleCheck, OctagonAlert } from 'lucide-react';
import { Button, Skeleton } from '@brd/ui';
import { useQuestionCounts } from '@/features/questions/hooks/use-questions';

interface OpenCriticalCardProps {
  projectId: string;
  onReview: () => void;
}

/** How many critical questions still block the project, with a shortcut to answer them. */
export function OpenCriticalCard({ projectId, onReview }: OpenCriticalCardProps) {
  const counts = useQuestionCounts(projectId);

  return (
    <section
      aria-label="Open critical questions"
      className="uab-panel flex flex-wrap items-center justify-between gap-3"
    >
      {counts.isPending && <Skeleton className="h-6 w-56" />}
      {counts.isError && (
        <p className="uab-muted">
          Could not load the question count.{' '}
          <Button variant="link" onClick={() => void counts.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {counts.isSuccess && counts.data.openCritical > 0 && (
        <>
          <div className="flex items-center gap-3">
            <OctagonAlert className="h-6 w-6 text-destructive" aria-hidden />
            <div>
              <p className="uab-stat-value" data-testid="critical-count">
                {counts.data.openCritical}
              </p>
              <p className="uab-muted">
                open critical question{counts.data.openCritical === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <Button variant="primary" onClick={onReview}>
            Review critical questions
          </Button>
        </>
      )}
      {counts.isSuccess && counts.data.openCritical === 0 && (
        <div className="flex items-center gap-3">
          <CircleCheck className="h-6 w-6 text-success" aria-hidden />
          <p>No open critical questions.</p>
        </div>
      )}
    </section>
  );
}
