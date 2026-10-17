import type {
  BusinessRuleDto,
  KnowledgeSourceDto,
  KnowledgeSummaryDto,
  ModuleDto,
  PagedResult,
  RequirementDto,
} from '@brd/shared';

export const DOC_ID = '11111111-1111-4111-8111-111111111111';
export const NOTE_ID = '22222222-2222-4222-8222-222222222222';
export const MODULE_ID = '33333333-3333-4333-8333-333333333333';

export function source(overrides: Partial<KnowledgeSourceDto> = {}): KnowledgeSourceDto {
  return {
    chunkId: 'c1',
    type: 'document',
    sourceId: DOC_ID,
    sourceTitle: 'Billing BRD',
    versionNumber: 1,
    headingPath: ['1. Scope', '1.1 Invoicing'],
    needsReview: false,
    ...overrides,
  };
}

const stamp = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' };

export function requirement(overrides: Partial<RequirementDto> = {}): RequirementDto {
  return {
    id: 'r1',
    title: 'Monthly invoice run',
    description: 'Invoice every active customer monthly.',
    status: 'CONFIRMED',
    priority: 1,
    module: { id: MODULE_ID, name: 'Billing' },
    createdBy: 'AI',
    source: source(),
    otherSources: [],
    ...stamp,
    ...overrides,
  };
}

export function rule(overrides: Partial<BusinessRuleDto> = {}): BusinessRuleDto {
  return {
    id: 'u1',
    title: 'VAT rate',
    description: 'VAT of 20% applies.',
    status: 'OPEN',
    module: { id: MODULE_ID, name: 'Billing' },
    createdBy: 'AI',
    source: source(),
    otherSources: [],
    ...stamp,
    ...overrides,
  };
}

export function moduleItem(overrides: Partial<ModuleDto> = {}): ModuleDto {
  return {
    id: MODULE_ID,
    name: 'Billing',
    code: 'BIL',
    description: null,
    status: 'CONFIRMED',
    requirementCount: 4,
    createdBy: 'AI',
    source: source(),
    otherSources: [],
    ...stamp,
    ...overrides,
  };
}

export function page<T>(items: T[], total = items.length): PagedResult<T> {
  return { items, page: 1, pageSize: 20, total };
}

const NO_STATUSES = { CONFIRMED: 0, ASSUMED: 0, OPEN: 0, REJECTED: 0, NEEDS_REVALIDATION: 0 };

export function summary(overrides: Partial<KnowledgeSummaryDto> = {}): KnowledgeSummaryDto {
  return {
    counts: { requirements: NO_STATUSES, rules: NO_STATUSES, modules: NO_STATUSES },
    chunksNeedingReview: 0,
    ...overrides,
  };
}

export const SOURCE_LISTS = {
  documents: {
    items: [{ id: DOC_ID, title: 'Billing BRD' }],
    page: 1,
    pageSize: 100,
    total: 1,
  },
  notes: { items: [{ id: NOTE_ID, title: 'Kickoff call' }], page: 1, pageSize: 100, total: 1 },
};
