import { Menu } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../../button';
import type { AppHeaderProps } from './types';
import { Breadcrumbs } from './Breadcrumbs';
import { UserMenu } from './UserMenu';

export function AppHeader({
  breadcrumbs,
  user,
  userMenuActions,
  onLogout,
  onMobileMenuOpen,
  actions,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        'bg-surface border-border flex h-12 shrink-0 items-center gap-3 border-b px-4',
      )}
    >
      {/* Mobile hamburger */}
      {onMobileMenuOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:hidden"
          onClick={onMobileMenuOpen}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      )}

      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}

      {/* User menu */}
      {user && (
        <UserMenu user={user} actions={userMenuActions} onLogout={onLogout} />
      )}
    </header>
  );
}
