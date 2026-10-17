import { cn } from '../lib/cn';
import { Skeleton } from '../skeleton';

interface TableRowSkeletonProps {
  rows?: number;
  className?: string;
}

export function TableRowSkeleton({ rows = 8, className }: TableRowSkeletonProps) {
  return (
    <div
      className={cn('mt-4 overflow-hidden rounded-xl border border-border bg-surface', className)}
    >
      <div className="flex items-center gap-4 border-b border-border bg-muted/50 px-4 py-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="ml-auto h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-6" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-4 px-4 py-3',
            i < rows - 1 && 'border-b border-border',
          )}
        >
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
      ))}
    </div>
  );
}
