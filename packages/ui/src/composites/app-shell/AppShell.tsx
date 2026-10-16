import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AppShell({ sidebar, children, className }: AppShellProps) {
  return (
    <div className={cn('flex h-screen w-screen overflow-hidden', className)}>
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
