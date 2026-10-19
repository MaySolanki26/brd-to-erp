import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface PageHeaderState {
  title: string;
  description?: string;
}

interface PageHeaderContextValue {
  header: PageHeaderState | null;
  setHeader: (header: PageHeaderState | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

/** Holds the current page's title so the top bar can show it (there is no title row in the page body). */
export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PageHeaderState | null>(null);
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

/** The title and description of the current page; null before a page has set one. */
export function usePageHeader(): PageHeaderState | null {
  return useContext(PageHeaderContext)?.header ?? null;
}

/**
 * Registers this page's title (and its ⓘ description) in the top bar. Returns true when a top bar
 * is present to show it, so the caller can fall back to an inline title outside the app shell.
 */
export function useSetPageHeader(title: string | undefined, description?: string): boolean {
  const context = useContext(PageHeaderContext);
  const setHeader = context?.setHeader;

  useEffect(() => {
    if (!setHeader || !title) return undefined;
    setHeader({ title, description });
    return () => setHeader(null);
  }, [setHeader, title, description]);

  return context !== null && Boolean(title);
}
