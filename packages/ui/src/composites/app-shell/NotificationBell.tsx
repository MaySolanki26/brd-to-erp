import { useRef, useState } from 'react';
import { cx } from '../../uab/lib/format';
import { Button, IconButton } from '../../uab/primitives/Button';
import { InfoTip } from '../../uab/primitives/InfoTip';
import { Popover } from '../../uab/primitives/overlay';
import type { NotificationEntry } from './types';

export interface NotificationBellProps {
  items: NotificationEntry[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  /** True while the list is sample data rather than the person's own notifications. */
  isSample?: boolean;
}

/** Bell with an unread count and a list; unread items carry a dot and bold text, not colour alone. */
export function NotificationBell({
  items,
  onMarkRead,
  onMarkAllRead,
  isSample = false,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const unread = items.filter((item) => !item.read).length;

  return (
    <>
      <IconButton
        ref={ref}
        icon="bell"
        label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        badge={unread}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={ref}
        label="Notifications"
        width={360}
        align="end"
      >
        <div className="uab-pop-head">
          <span className="uab-dialog-title-row">
            <strong>Notifications</strong>
            <InfoTip
              text={
                isSample
                  ? 'Sample notifications. Live notifications are not connected yet.'
                  : 'Reading a notification never approves or completes the linked work.'
              }
              label="About notifications"
            />
          </span>
          <Button
            variant="ghost"
            onClick={onMarkAllRead}
            disabledReason={unread ? undefined : 'Nothing unread'}
          >
            Mark all read
          </Button>
        </div>
        {isSample && <p className="uab-muted uab-small uab-pop-empty">Sample notifications</p>}
        {items.length ? (
          <ul className="uab-notif-list">
            {items.map((item) => (
              <li key={item.id} className={cx('uab-notif', !item.read && 'uab-is-unread')}>
                <button
                  type="button"
                  className="uab-notif-main"
                  onClick={() => {
                    onMarkRead(item.id);
                    setOpen(false);
                    item.onOpen?.();
                  }}
                >
                  {!item.read && <span className="uab-unread-dot" aria-label="Unread" />}
                  <span>
                    <span className="uab-notif-title">{item.title}</span>
                    <span className="uab-muted uab-small">
                      {item.body ? `${item.body} · ` : ''}
                      {item.time}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="uab-muted uab-pop-empty">You’re all caught up.</p>
        )}
      </Popover>
    </>
  );
}
