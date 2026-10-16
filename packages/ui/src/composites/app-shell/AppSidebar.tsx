import { useMemo } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../../button';
import { Separator } from '../../separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../tooltip';
import type { AppSidebarProps } from './types';
import { SidebarBranding } from './SidebarBranding';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarNavGroup } from './SidebarNavGroup';
import { SidebarUserSection } from './SidebarUserSection';

export function AppSidebar({
  items,
  activeKey,
  collapsed,
  onToggle,
  branding,
  user,
  onLogout,
}: AppSidebarProps) {
  const visibleItems = useMemo(() => items.filter((i) => i.visible !== false), [items]);

  return (
    <aside
      className={cn(
        'bg-surface border-border hidden flex-col border-r transition-[width] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] md:flex',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Branding */}
      {branding && <SidebarBranding collapsed={collapsed}>{branding}</SidebarBranding>}
      {branding && <Separator />}

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2">
        {visibleItems.map((item) =>
          item.children && item.children.length > 0 ? (
            <SidebarNavGroup
              key={item.key}
              icon={item.icon}
              label={item.label}
              children={item.children}
              activeKey={activeKey}
              collapsed={collapsed}
            />
          ) : (
            <SidebarNavItem
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={item.key === activeKey}
              collapsed={collapsed}
              href={item.href}
              onClick={item.onClick}
              badge={item.badge}
            />
          ),
        )}
      </nav>

      {/* Collapse toggle */}
      <Separator />
      <div className={cn('flex shrink-0 items-center px-2 py-1.5', collapsed && 'justify-center')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={onToggle}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* User section */}
      {user && (
        <>
          <Separator />
          <SidebarUserSection user={user} collapsed={collapsed} onLogout={onLogout} />
        </>
      )}
    </aside>
  );
}
