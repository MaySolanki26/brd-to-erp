import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../tooltip';
import type { NavChildItem } from './types';

interface SidebarNavGroupProps {
  icon: LucideIcon;
  label: string;
  children: NavChildItem[];
  activeKey: string;
  collapsed?: boolean;
}

export function SidebarNavGroup({
  icon: Icon,
  label,
  children,
  activeKey,
  collapsed = false,
}: SidebarNavGroupProps) {
  const visibleChildren = useMemo(
    () => children.filter((c) => c.visible !== false),
    [children],
  );

  const hasActiveChild = visibleChildren.some((c) => c.key === activeKey);
  const [open, setOpen] = useState(hasActiveChild);

  if (visibleChildren.length === 0) return null;

  // Collapsed mode: show icon with tooltip listing children
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full items-center justify-center rounded-md px-0 py-2 text-xl font-medium transition-colors',
              hasActiveChild
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex flex-col gap-1">
          <span className="font-semibold">{label}</span>
          {visibleChildren.map((child) => (
            <span key={child.key} className={cn(child.key === activeKey && 'text-primary')}>
              {child.label}
            </span>
          ))}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-xl font-medium transition-colors',
            hasActiveChild
              ? 'text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronRight
            className={cn(
              'ml-auto h-4 w-4 shrink-0 transition-transform duration-200',
              open && 'rotate-90',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-[18px] border-l border-border pl-3 pt-1">
          {visibleChildren.map((child) => {
            const isActive = child.key === activeKey;
            const childClasses = cn(
              'flex w-full items-center rounded-md px-2.5 py-1.5 text-xl transition-colors',
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            );

            return child.href ? (
              <a key={child.key} href={child.href} className={childClasses}>
                {child.label}
              </a>
            ) : (
              <button
                key={child.key}
                type="button"
                onClick={child.onClick}
                className={childClasses}
              >
                {child.label}
              </button>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
