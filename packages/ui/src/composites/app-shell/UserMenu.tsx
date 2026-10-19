import { useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { cx } from '../../uab/lib/format';
import { Popover } from '../../uab/primitives/overlay';
import { Avatar } from '../../uab/primitives/feedback';
import type { AppShellUser, UserMenuAction } from './types';

interface UserMenuProps {
  user: AppShellUser;
  actions?: UserMenuAction[];
  onLogout?: () => void;
}

/** Account button with the person's name and role, and a menu of account actions. */
export function UserMenu({ user, actions = [], onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const roleText = user.role ? `, ${user.role}` : '';

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="uab-account-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Account: ${user.name}${roleText}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={user.name} size={26} />
        <span className="uab-account-text uab-hide-phone">
          <span className="uab-account-name">{user.name}</span>
          {user.role && <span className="uab-account-role">{user.role}</span>}
        </span>
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={ref}
        label="Account"
        width={260}
        align="end"
      >
        {user.email && <p className="uab-pop-label">{user.email}</p>}
        <ul className="uab-menu">
          {actions.map((action) => (
            <li key={action.key}>
              <button
                type="button"
                className={cx('uab-menu-item', action.destructive && 'uab-is-danger')}
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
              >
                {action.icon && (
                  <action.icon size={16} strokeWidth={1.75} aria-hidden="true" focusable={false} />
                )}
                <span className="uab-menu-label">{action.label}</span>
              </button>
            </li>
          ))}
          {onLogout && (
            <li>
              <button
                type="button"
                className="uab-menu-item"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
              >
                <LogOut size={16} strokeWidth={1.75} aria-hidden="true" focusable={false} />
                <span className="uab-menu-label">Log out</span>
              </button>
            </li>
          )}
        </ul>
      </Popover>
    </>
  );
}
