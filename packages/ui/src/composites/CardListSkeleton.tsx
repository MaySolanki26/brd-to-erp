import { cn } from '../lib/cn';
import { Skeleton } from '../skeleton';

interface CardListSkeletonProps {
  rows?: number;
  withSwitch?: boolean;
  withSelect?: boolean;
  className?: string;
}

export function CardListSkeleton({
  rows = 5,
  withSwitch = false,
  withSelect = false,
  className,
}: CardListSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-start justify-between rounded-lg border border-border bg-surface p-4 "
        >
          <div className="flex-1 space-y-2 pr-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-12 rounded" />
              <Skeleton className="h-5 w-14 rounded" />
            </div>
            <Skeleton className="h-3 w-3/4 max-w-md" />
          </div>

          <div className="shrink-0">
            {withSwitch && <Skeleton className="h-6 w-10 rounded-full" />}
            {withSelect && <Skeleton className="h-7 w-28 rounded" />}
          </div>
        </div>
      ))}
    </div>
  );
}
