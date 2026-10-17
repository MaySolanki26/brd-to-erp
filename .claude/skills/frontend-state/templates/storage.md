# Storage Wrapper Template

`src/lib/storage.ts`

```ts
import { z, type ZodType } from 'zod';

const APP = 'erp';

type Scope = 'app' | { userId: string };

function buildKey(scope: Scope, name: string, version: number): string {
  const scopePart = scope === 'app' ? 'app' : `user:${scope.userId}`;
  return `${APP}:${scopePart}:${name}:v${version}`;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage disabled / private mode
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // quota exceeded or disabled — preferences are optional
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface StorageItem<T> {
  get(): T;
  set(value: T): void;
  remove(): void;
}

/**
 * Define a typed, versioned, validated storage item.
 * Never use for tokens or personal data.
 */
export function defineStorageItem<T>(options: {
  name: string;
  version: number;
  schema: ZodType<T>;
  defaultValue: T;
  scope: Scope;
}): StorageItem<T> {
  const key = buildKey(options.scope, options.name, options.version);

  return {
    get() {
      const raw = safeGet(key);
      if (raw === null) return options.defaultValue;
      try {
        const parsed = options.schema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
      } catch {
        /* invalid JSON */
      }
      safeRemove(key);
      return options.defaultValue;
    },
    set(value) {
      const parsed = options.schema.parse(value);
      safeSet(key, JSON.stringify(parsed));
    },
    remove() {
      safeRemove(key);
    },
  };
}

/** Remove all keys for a user (call on logout). */
export function clearUserStorage(userId: string): void {
  try {
    const prefix = `${APP}:user:${userId}:`;
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach(safeRemove);
  } catch {
    /* ignore */
  }
}

/** Remove keys of old versions (call once on app start). */
export function removeStaleVersions(current: Record<string, number>): void {
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(`${APP}:`))
      .forEach((k) => {
        const match = /:([^:]+):v(\d+)$/.exec(k);
        if (!match) return;
        const [, name, version] = match;
        const latest = current[name];
        if (latest !== undefined && Number(version) !== latest) safeRemove(k);
      });
  } catch {
    /* ignore */
  }
}
```

## Usage

```ts
export const themePreference = defineStorageItem({
  name: 'theme',
  version: 1,
  scope: 'app',
  schema: z.enum(['light', 'dark', 'system']),
  defaultValue: 'system',
});

export const tableDensity = (userId: string) =>
  defineStorageItem({
    name: 'table-density',
    version: 1,
    scope: { userId },
    schema: z.enum(['compact', 'comfortable']),
    defaultValue: 'comfortable',
  });
```

## Tests

- invalid JSON → default + key removed
- schema mismatch → default + key removed
- storage throws → default, no crash
- logout clears only that user's keys
