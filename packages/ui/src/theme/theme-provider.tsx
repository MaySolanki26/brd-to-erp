import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { safeStorage } from '../lib/safe-storage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedMode = 'light' | 'dark';

/** Must match the key read by the inline script in index.html. */
export const THEME_STORAGE_KEY = 'brd-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedMode: ResolvedMode;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isPreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readPreference(storageKey: string, fallback: ThemePreference): ThemePreference {
  const stored = safeStorage.get(storageKey);
  return isPreference(stored) ? stored : fallback;
}

function systemMode(): ResolvedMode {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function resolveMode(preference: ThemePreference): ResolvedMode {
  return preference === 'system' ? systemMode() : preference;
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultPreference?: ThemePreference;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultPreference = 'system',
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState(() =>
    readPreference(storageKey, defaultPreference),
  );
  const [resolvedMode, setResolvedMode] = useState(() => resolveMode(preference));

  useEffect(() => {
    const apply = () => setResolvedMode(resolveMode(preference));
    apply();
    if (preference !== 'system') return undefined;
    const media = window.matchMedia(DARK_QUERY);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedMode;
  }, [resolvedMode]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      safeStorage.set(storageKey, next);
      setPreferenceState(next);
    },
    [storageKey],
  );

  const value = useMemo(
    () => ({ preference, resolvedMode, setPreference }),
    [preference, resolvedMode, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
