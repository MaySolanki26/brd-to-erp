import { useCallback, useMemo, useState } from 'react';
import { MAX_FAVORITES, favoritesStore, type SavedPage } from '../shell-preferences';

/** Starred pages, saved per user. Newest first, so the latest star sits at the top of "Favorites". */
export function useFavorites(userId: string) {
  const store = useMemo(() => favoritesStore(userId), [userId]);
  const [pages, setPages] = useState<SavedPage[]>(() => store.get());

  const toggle = useCallback(
    (page: SavedPage) => {
      setPages((current) => {
        const next = current.some((existing) => existing.key === page.key)
          ? current.filter((existing) => existing.key !== page.key)
          : [page, ...current].slice(0, MAX_FAVORITES);
        store.set(next);
        return next;
      });
    },
    [store],
  );

  return { pages, keys: useMemo(() => pages.map((page) => page.key), [pages]), toggle };
}
