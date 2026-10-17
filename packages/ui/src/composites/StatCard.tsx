import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subValue?: string;
  iconClassName?: string;
  highlight?: boolean;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  iconClassName,
  highlight,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-surface flex items-center gap-3 rounded-2xl border border-border p-3.5',
        highlight && 'border-warning/30 bg-warning-light/30',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl',
          iconClassName || 'bg-primary/10 text-primary',
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-foreground text-4xl font-semibold">{value}</p>
        <p className="text-muted-foreground text-lg">
          {label}
          {subValue && <span className="ml-1">{subValue}</span>}
        </p>
      </div>
    </div>
  );
}
