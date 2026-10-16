export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  users: {
    all: () => ['users'] as const,
    list: (filters?: Record<string, unknown>) => ['users', 'list', filters] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },
  projects: {
    all: () => ['projects'] as const,
    list: (filters?: Record<string, unknown>) => ['projects', 'list', filters] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
  },
  documents: {
    all: () => ['documents'] as const,
    list: (filters?: Record<string, unknown>) => ['documents', 'list', filters] as const,
    detail: (id: string) => ['documents', 'detail', id] as const,
  },
} as const;
