import { Skeleton } from '../uab/primitives/feedback';

interface CardListSkeletonProps {
  rows?: number;
  withSwitch?: boolean;
  withSelect?: boolean;
  className?: string;
}

export function CardListSkeleton({ rows = 5 }: CardListSkeletonProps) {
  return <Skeleton rows={rows} />;
}
