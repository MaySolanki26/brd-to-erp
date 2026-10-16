import { useCallback, useState } from 'react';
import type { SidebarState } from './types';

const STORAGE_KEY = 'brd-sidebar-collapsed';

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useSidebarState(): SidebarState {
  const [collapsed, setCollapsed] = useState(readInitial);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
