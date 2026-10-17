import { ShieldX } from 'lucide-react';
import { cn } from '../lib/cn';

interface NoAccessProps {
  title?: string;
  description?: string;
  variant?: 'inline' | 'full';
  className?: string;
}

export function NoAccess({
  title = 'Access restricted',
  description = "You don't have permission to view this page.",
  variant = 'inline',
  className,
}: NoAccessProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        variant === 'full'
          ? 'h-full'
          : 'mt-4 rounded-xl border border-border bg-surface py-12',
        className,
      )}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-warning-light">
        <ShieldX className="h-5 w-5 text-warning" strokeWidth={1.5} />
      </div>

      <p className="text-foreground text-xl font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 max-w-xs text-lg">{description}</p>
    </div>
  );
}
