import { cn } from './lib/cn';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('bg-muted animate-pulse rounded-md', className)} />;
}
