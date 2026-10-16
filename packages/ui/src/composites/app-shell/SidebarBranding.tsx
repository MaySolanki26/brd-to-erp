import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface SidebarBrandingProps {
  children: ReactNode;
  collapsed: boolean;
}

export function SidebarBranding({ children, collapsed }: SidebarBrandingProps) {
  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center overflow-hidden px-3',
        collapsed && 'justify-center',
      )}
    >
      {children}
    </div>
  );
}
