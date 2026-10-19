import { Skeleton } from '../uab/primitives/feedback';

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

/** Loading state for a table: template skeleton rows. */
export function TableSkeleton({ rows = 8 }: TableSkeletonProps) {
  return (
    <div className="uab-page">
      <Skeleton rows={rows} />
    </div>
  );
}
