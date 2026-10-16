import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface ActionBarProps {
  children?: ReactNode;
  right?: ReactNode;
  bordered?: boolean;
  className?: string;
}

export function ActionBar({ children, right, bordered = false, className }: ActionBarProps) {
  return (
    <div
      className={cn(
        'bg-surface flex h-11 shrink-0 items-center gap-2 px-4',
        bordered && 'border-border border-b',
        className,
      )}
    >
      {children}
      {right && <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}
