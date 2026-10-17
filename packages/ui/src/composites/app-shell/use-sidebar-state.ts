import { useCallback, useState } from 'react';
import { safeStorage } from '../../lib/safe-storage';
import type { SidebarState } from './types';

const STORAGE_KEY = 'brd-sidebar-collapsed';

export function useSidebarState(): SidebarState {
  const [collapsed, setCollapsed] = useState(() => safeStorage.get(STORAGE_KEY) === 'true');

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      safeStorage.set(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
