import { cn } from './lib/cn';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/** A placeholder bar (the template skeleton row). */
export function Skeleton({ className, style }: SkeletonProps) {
  return <span className={cn('uab-skeleton-row', className)} style={style} />;
}
