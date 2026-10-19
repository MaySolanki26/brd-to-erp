import { Skeleton } from '../uab/primitives/feedback';

interface TableRowSkeletonProps {
  rows?: number;
  className?: string;
}

export function TableRowSkeleton({ rows = 8 }: TableRowSkeletonProps) {
  return <Skeleton rows={rows} />;
}
