import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { hiddenColumnsStore } from '../shell-preferences';

/** The columns hidden in one table, remembered per person on this device. */
export function useHiddenColumns(table: string): [string[], (ids: string[]) => void] {
  const { user } = useAuth();
  const store = useMemo(() => hiddenColumnsStore(user?.id ?? '', table), [user?.id, table]);
  const [hidden, setHidden] = useState<string[]>(() => store.get());

  const change = useCallback(
    (ids: string[]) => {
      store.set(ids);
      setHidden(ids);
    },
    [store],
  );

  return [hidden, change];
}
