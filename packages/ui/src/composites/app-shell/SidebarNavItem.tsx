import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../tooltip';

interface SidebarNavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  href?: string;
  onClick?: () => void;
  badge?: ReactNode;
}

export function SidebarNavItem({
  icon: Icon,
  label,
  active = false,
  collapsed = false,
  href,
  onClick,
  badge,
}: SidebarNavItemProps) {
  const classes = cn(
    'group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-xl font-medium transition-colors',
    active
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    collapsed && 'justify-center px-0',
  );

  const content = (
    <>
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && (
        <>
          <span className="truncate">{label}</span>
          {badge != null && <span className="ml-auto shrink-0">{badge}</span>}
        </>
      )}
    </>
  );

  const element = href ? (
    <a href={href} className={classes}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{element}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return element;
}
