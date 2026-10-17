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
    members: (id: string) => ['projects', 'detail', id, 'members'] as const,
    candidates: (id: string) => ['projects', 'detail', id, 'candidates'] as const,
    documents: (id: string) => ['projects', 'detail', id, 'documents'] as const,
    document: (id: string, docId: string, versionId: string | null, page: number) =>
      ['projects', 'detail', id, 'documents', docId, versionId, page] as const,
    notes: (id: string) => ['projects', 'detail', id, 'notes'] as const,
    processingStatus: (id: string) => ['projects', 'detail', id, 'processing-status'] as const,
    knowledge: (id: string, kind: string, filters?: Record<string, unknown>) =>
      ['projects', 'detail', id, 'knowledge', kind, filters] as const,
    knowledgeSummary: (id: string) => ['projects', 'detail', id, 'knowledge-summary'] as const,
    chunk: (id: string, chunkId: string) => ['projects', 'detail', id, 'chunks', chunkId] as const,
    /** Prefix of every question query (lists and counts), for invalidation. */
    questionsAll: (id: string) => ['projects', 'detail', id, 'questions'] as const,
    questions: (id: string, filters: Record<string, unknown>) =>
      ['projects', 'detail', id, 'questions', 'list', filters] as const,
    questionCounts: (id: string) => ['projects', 'detail', id, 'questions', 'counts'] as const,
    decisions: (id: string) => ['projects', 'detail', id, 'decisions'] as const,
    summaryAll: (id: string) => ['projects', 'detail', id, 'summary'] as const,
    summary: (id: string, version: number | null) =>
      ['projects', 'detail', id, 'summary', version] as const,
  },
  documents: {
    all: () => ['documents'] as const,
    list: (filters?: Record<string, unknown>) => ['documents', 'list', filters] as const,
    detail: (id: string) => ['documents', 'detail', id] as const,
  },
} as const;
