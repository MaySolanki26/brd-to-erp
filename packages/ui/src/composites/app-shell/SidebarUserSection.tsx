import { LogOut } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../../button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../tooltip';
import { UserAvatar } from '../UserAvatar';
import type { AppShellUser } from './types';

interface SidebarUserSectionProps {
  user: AppShellUser;
  collapsed: boolean;
  onLogout?: () => void;
}

export function SidebarUserSection({ user, collapsed, onLogout }: SidebarUserSectionProps) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="rounded-full">
              <UserAvatar
                name={user.name}
                src={user.avatarUrl}
                className="h-8 w-8 text-md"
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <div className="flex flex-col">
              <span className="font-medium">{user.name}</span>
              {user.role && <span className="text-muted-foreground">{user.role}</span>}
            </div>
          </TooltipContent>
        </Tooltip>
        {onLogout && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Log out</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <UserAvatar name={user.name} src={user.avatarUrl} className="h-8 w-8 shrink-0 text-md" />
      <div className={cn('flex min-w-0 flex-1 flex-col')}>
        <span className="truncate text-xl font-medium text-foreground">{user.name}</span>
        {user.role && (
          <span className="truncate text-lg text-muted-foreground">{user.role}</span>
        )}
      </div>
      {onLogout && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
