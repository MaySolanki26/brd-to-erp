import type {
  DecisionChangeDto,
  DecisionDto,
  QuestionCountsDto,
  QuestionDto,
  SummaryDto,
  SummaryResponseDto,
} from '@brd/shared';

export function question(overrides: Partial<QuestionDto> = {}): QuestionDto {
  return {
    id: 'q1',
    text: 'What happens to unpaid invoices?',
    reason: 'GAP',
    priority: 'NORMAL',
    status: 'OPEN',
    version: 1,
    module: null,
    linkedItems: [],
    answer: null,
    dismissal: null,
    followUpOf: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function counts(overrides: Partial<QuestionCountsDto> = {}): QuestionCountsDto {
  return {
    byStatus: { OPEN: 2, ANSWERED: 1, DISMISSED: 0 },
    openByPriority: { CRITICAL: 1, HIGH: 1, NORMAL: 0 },
    openCritical: 1,
    ...overrides,
  };
}

export const page = <T>(
  items: T[],
  overrides: { page?: number; pageSize?: number; total?: number } = {},
) => ({
  items,
  page: overrides.page ?? 1,
  pageSize: overrides.pageSize ?? 50,
  total: overrides.total ?? items.length,
});

export function change(overrides: Partial<DecisionChangeDto> = {}): DecisionChangeDto {
  return {
    kind: 'requirement',
    id: 'r1',
    title: 'Remind customers',
    before: { status: 'OPEN', title: 'Remind customers', description: null },
    after: { status: 'CONFIRMED', title: 'Remind customers', description: null },
    reason: null,
    ...overrides,
  };
}

export function decision(overrides: Partial<DecisionDto> = {}): DecisionDto {
  return {
    id: 'd1',
    question: { id: 'q1', text: 'When do we remind customers?' },
    answer: 'After 7 days.',
    summary: 'Reminders go out after seven days.',
    decidedBy: { id: 'u1', name: 'Ann Analyst' },
    decidedAt: '2026-03-01T10:30:00.000Z',
    changes: [change()],
    conflicts: [],
    ...overrides,
  };
}

export function summary(overrides: Partial<SummaryDto> = {}): SummaryDto {
  return {
    version: 2,
    generatedAt: '2026-03-02T09:00:00.000Z',
    basedOn: { requirements: 12, rules: 5 },
    content: {
      overview: 'An invoicing ERP for small retailers.',
      modules: [{ id: 'm1', name: 'Finance', summary: 'Invoices and payments.' }],
      keyRequirements: [{ id: 'r1', title: 'Approve invoices', why: 'Core flow.' }],
      keyRules: [{ id: 'u1', title: 'Limit is 10k', why: 'Controls spend.' }],
      assumptions: [
        { kind: 'rule', id: 'u1', title: 'Limit is 10k', statement: 'Applies to everyone.' },
      ],
      staleItems: [{ kind: 'requirement', id: 'r2', title: 'Old export' }],
    },
    ...overrides,
  };
}

export function summaryResponse(
  current: SummaryDto | null = summary(),
  versions = [
    { version: 2, generatedAt: '2026-03-02T09:00:00.000Z' },
    { version: 1, generatedAt: '2026-03-01T09:00:00.000Z' },
  ],
): SummaryResponseDto {
  return { summary: current, versions: current ? versions : [] };
}
