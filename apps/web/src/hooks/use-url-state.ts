import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ZodObject, ZodRawShape, z } from 'zod';

/**
 * View state (page, search, sort, filters) kept in the address so links can be shared and
 * back/forward works. Every field in the schema must carry a default (`.catch(default)`), so an
 * invalid or missing value falls back to it. Values equal to their default are left out of the URL.
 */
export function useUrlState<TShape extends ZodRawShape>(schema: ZodObject<TShape>) {
  type State = z.output<ZodObject<TShape>>;
  const [searchParams, setSearchParams] = useSearchParams();
  const keys = useMemo(() => Object.keys(schema.shape), [schema]);
  const defaults = useMemo(() => schema.parse({}) as State, [schema]);

  const state = useMemo(() => {
    const raw: Record<string, string> = {};
    for (const key of keys) {
      const value = searchParams.get(key);
      if (value !== null) raw[key] = value;
    }
    return schema.parse(raw) as State;
  }, [keys, schema, searchParams]);

  const update = useCallback(
    (patch: Partial<State>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const merged = { ...state, ...patch } as Record<string, unknown>;
          for (const key of keys) {
            const value = merged[key];
            if (value === (defaults as Record<string, unknown>)[key]) next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
    [defaults, keys, setSearchParams, state],
  );

  return [state, update] as const;
}
