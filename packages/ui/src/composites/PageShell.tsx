import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Page-height container. Use with InformativeBar / SwitcherBar / ActionBar
 * (fixed-height, shrink-0 rows) followed by a PageShell.Body that flexes to
 * fill and scrolls.
 */
export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col', className)}>
      {children}
    </div>
  );
}

interface PageShellBodyProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  scroll?: boolean;
}

export function PageShellBody({
  children,
  className,
  padded = false,
  scroll = true,
}: PageShellBodyProps) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        scroll && 'overflow-y-auto',
        padded && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

PageShell.Body = PageShellBody;
