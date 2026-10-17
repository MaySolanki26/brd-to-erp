import { cn } from '../lib/cn';
import { Skeleton } from '../skeleton';

export type TableSkeletonColumn =
  | { kind: 'avatar' }
  | { kind: 'icon' }
  | { kind: 'switch' }
  | { kind: 'select' }
  | { kind: 'badge'; widthClass?: string }
  | { kind: 'text'; widthClass?: string };

interface TableSkeletonProps {
  rows?: number;
  columns: TableSkeletonColumn[];
  className?: string;
}

export function TableSkeleton({ rows = 8, columns, className }: TableSkeletonProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-surface ',
        className,
      )}
    >
      <div className="flex items-center gap-4 border-b border-border bg-muted px-4 py-2 text-lg ">
        {columns.map((_, i) => (
          <Skeleton
            key={i}
            className={cn('h-3', i === columns.length - 1 ? 'ml-auto w-12' : 'w-20')}
          />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className={cn(
            'flex items-center gap-4 px-4 py-3',
            rowIdx < rows - 1 && 'border-b border-border ',
          )}
        >
          {columns.map((col, colIdx) => (
            <ColumnCell
              key={colIdx}
              col={col}
              alignRight={colIdx === columns.length - 1 && col.kind === 'icon'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ColumnCell({ col, alignRight }: { col: TableSkeletonColumn; alignRight: boolean }) {
  switch (col.kind) {
    case 'avatar':
      return <Skeleton className="h-8 w-8 shrink-0 rounded-full" />;
    case 'icon':
      return <Skeleton className={cn('h-6 w-16 rounded', alignRight && 'ml-auto')} />;
    case 'switch':
      return <Skeleton className="h-6 w-10 shrink-0 rounded-full" />;
    case 'select':
      return <Skeleton className="h-7 w-24 rounded" />;
    case 'badge':
      return <Skeleton className={cn('h-5 rounded-full', col.widthClass ?? 'w-20')} />;
    case 'text':
      return <Skeleton className={cn('h-3.5', col.widthClass ?? 'w-28')} />;
  }
}
