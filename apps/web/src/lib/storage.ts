import type { ZodType } from 'zod';

/**
 * Typed, versioned browser storage for small UI preferences.
 * Never store tokens, roles, personal data or API responses here.
 * Keys look like `brd:user:<id>:<name>:v<n>` so shared computers do not mix users.
 */
const APP = 'brd';

type Scope = 'app' | { userId: string };

function buildKey(scope: Scope, name: string, version: number): string {
  const scopePart = scope === 'app' ? 'app' : `user:${scope.userId}`;
  return `${APP}:${scopePart}:${name}:v${version}`;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or storage disabled: preferences are optional.
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage disabled: nothing to remove.
  }
}

export interface StorageItem<T> {
  get(): T;
  set(value: T): void;
  remove(): void;
}

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
        // Invalid JSON falls through to the reset below.
      }
      safeRemove(key);
      return options.defaultValue;
    },
    set(value) {
      safeSet(key, JSON.stringify(options.schema.parse(value)));
    },
    remove() {
      safeRemove(key);
    },
  };
}

/** Removes every stored preference of one user. Call on sign-out. */
export function clearUserStorage(userId: string): void {
  try {
    const prefix = `${APP}:user:${userId}:`;
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach(safeRemove);
  } catch {
    // Storage disabled: nothing to clear.
  }
}
