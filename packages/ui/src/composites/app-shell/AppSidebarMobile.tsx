import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Sheet, SheetContent, SheetTitle } from '../../sheet';
import { Separator } from '../../separator';
import type { NavItem, AppShellUser } from './types';
import { SidebarBranding } from './SidebarBranding';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarNavGroup } from './SidebarNavGroup';
import { SidebarUserSection } from './SidebarUserSection';

interface AppSidebarMobileProps {
  items: NavItem[];
  activeKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branding?: ReactNode;
  user?: AppShellUser;
  onLogout?: () => void;
}

export function AppSidebarMobile({
  items,
  activeKey,
  open,
  onOpenChange,
  branding,
  user,
  onLogout,
}: AppSidebarMobileProps) {
  const visibleItems = useMemo(() => items.filter((i) => i.visible !== false), [items]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" hideClose className="w-72 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        {/* Branding */}
        {branding && <SidebarBranding collapsed={false}>{branding}</SidebarBranding>}
        {branding && <Separator />}

        {/* Navigation */}
        <nav className={cn('flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2')}>
          {visibleItems.map((item) =>
            item.children && item.children.length > 0 ? (
              <SidebarNavGroup
                key={item.key}
                icon={item.icon}
                label={item.label}
                children={item.children}
                activeKey={activeKey}
                collapsed={false}
              />
            ) : (
              <SidebarNavItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                active={item.key === activeKey}
                collapsed={false}
                href={item.href}
                onClick={() => {
                  item.onClick?.();
                  onOpenChange(false);
                }}
                badge={item.badge}
              />
            ),
          )}
        </nav>

        {/* User section */}
        {user && (
          <>
            <Separator />
            <SidebarUserSection user={user} collapsed={false} onLogout={onLogout} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
