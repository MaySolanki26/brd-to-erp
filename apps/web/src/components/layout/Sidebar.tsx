import { NavLink } from 'react-router-dom';
import { Separator, Button } from '@brd/ui';
import { LayoutDashboard, FileText, Users, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl font-bold">
          B
        </div>
        <span className="text-2xl font-semibold text-foreground">BRD Platform</span>
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-lg font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`
            }
          >
            <Icon className="h-4 w-4" strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {user?.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() ?? '??'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-medium text-foreground">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.role.name}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={logout} title="Sign out">
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
