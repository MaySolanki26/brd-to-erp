import { useCallback, useMemo, useState } from 'react';
import { MAX_RECENTS, recentsStore, type SavedPage } from '../shell-preferences';

/** The pages the person opened last, saved per user. */
export function useRecents(userId: string) {
  const store = useMemo(() => recentsStore(userId), [userId]);
  const [pages, setPages] = useState<SavedPage[]>(() => store.get());

  const record = useCallback(
    (page: SavedPage) => {
      setPages((current) => {
        if (current[0]?.key === page.key && current[0].label === page.label) return current;
        const next = [page, ...current.filter((existing) => existing.key !== page.key)].slice(
          0,
          MAX_RECENTS,
        );
        store.set(next);
        return next;
      });
    },
    [store],
  );

  return { pages, record };
}
