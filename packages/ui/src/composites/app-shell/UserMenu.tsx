import { LogOut } from 'lucide-react';
import { Button } from '../../button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../dropdown-menu';
import { UserAvatar } from '../UserAvatar';
import type { AppShellUser, UserMenuAction } from './types';

interface UserMenuProps {
  user: AppShellUser;
  actions?: UserMenuAction[];
  onLogout?: () => void;
}

export function UserMenu({ user, actions, onLogout }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
          <UserAvatar name={user.name} src={user.avatarUrl} className="h-8 w-8 text-md" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-xl font-medium leading-none">{user.name}</p>
            {user.email && (
              <p className="text-lg leading-none text-muted-foreground">{user.email}</p>
            )}
          </div>
        </DropdownMenuLabel>
        {actions && actions.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.key}
                onClick={action.onClick}
                className={action.destructive ? 'text-destructive' : undefined}
              >
                {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                {action.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {onLogout && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
