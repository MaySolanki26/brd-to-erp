import { useCallback, useMemo, useState } from 'react';
import type { NotificationEntry } from '@brd/ui';
import { SAMPLE_NOTIFICATIONS } from '../sample-notifications';

/** Read state for the sample notifications. It lives in memory only: nothing is stored or sent. */
export function useSampleNotifications() {
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());

  const items: NotificationEntry[] = useMemo(
    () => SAMPLE_NOTIFICATIONS.map((item) => ({ ...item, read: read.has(item.id) })),
    [read],
  );

  const markRead = useCallback((id: string) => setRead((current) => new Set(current).add(id)), []);
  const markAllRead = useCallback(
    () => setRead(new Set(SAMPLE_NOTIFICATIONS.map((item) => item.id))),
    [],
  );

  return { items, markRead, markAllRead };
}
