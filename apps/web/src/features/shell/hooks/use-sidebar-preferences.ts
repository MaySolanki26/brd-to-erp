import { useCallback, useState } from 'react';
import { sidebarStore, type SidebarPreferences } from '../shell-preferences';

export function useSidebarPreferences() {
  const [prefs, setPrefs] = useState<SidebarPreferences>(() => sidebarStore.get());

  const update = useCallback((patch: Partial<SidebarPreferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      sidebarStore.set(next);
      return next;
    });
  }, []);

  return {
    width: prefs.width,
    collapsed: prefs.collapsed,
    setWidth: (width: number) => update({ width }),
    setCollapsed: (collapsed: boolean) => update({ collapsed }),
  };
}
