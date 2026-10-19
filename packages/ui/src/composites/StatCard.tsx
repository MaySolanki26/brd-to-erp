import type { LucideIcon } from 'lucide-react';
import { cx } from '../uab/lib/format';

interface StatCardProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  subValue?: string;
  /** Kept for compatibility; the template tile has no coloured icon box. */
  iconClassName?: string;
  highlight?: boolean;
}

/** One tile of the template stats strip. Place several inside `StatGrid`. */
export function StatCard({ label, value, subValue, highlight }: StatCardProps) {
  return (
    <div className={cx('uab-stat', highlight && 'uab-tone-warning')}>
      <span className="uab-stat-label">{label}</span>
      <span className="uab-stat-value">{value}</span>
      {subValue && <span className="uab-stat-sub">{subValue}</span>}
    </div>
  );
}

/** The strip that holds the stat tiles: one bordered surface with hairlines between the tiles. */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="uab-stats">{children}</div>;
}
