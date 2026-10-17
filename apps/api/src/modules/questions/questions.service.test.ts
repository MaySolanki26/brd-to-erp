import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserDto } from '@brd/shared';

const repo = vi.hoisted(() => ({
  listQuestions: vi.fn(),
  countByStatus: vi.fn(),
  countOpenByPriority: vi.fn(),
  findQuestion: vi.fn(),
  findConflictState: vi.fn(),
  claimForAnswer: vi.fn(),
  claimForDismissal: vi.fn(),
  createAnswer: vi.fn(),
}));
const queue = vi.hoisted(() => ({ enqueueJob: vi.fn() }));

vi.mock('./questions.repository.js', () => repo);
vi.mock('../../services/queue.service.js', () => queue);
vi.mock('../audit/audit.repository.js', () => ({ createAuditLog: vi.fn() }));
vi.mock('../../lib/logger.js', () => ({
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
}));
vi.mock('../../lib/transaction.js', () => ({
  withTransaction: <T>(fn: (tx: object) => Promise<T>) => fn({}),
}));

import {
  answerQuestion,
  dismissQuestion,
  foldModuleCounts,
  getCounts,
  toQuestionDto,
} from './questions.service.js';

const user: UserDto = {
  id: 'u1',
  email: 'a@b.c',
  name: 'Ann',
  organizationId: 'o1',
  orgRole: 'MEMBER',
  mustChangePassword: false,
  role: { id: 'MEMBER', name: 'MEMBER' },
};

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    content: 'Why?',
    status: 'OPEN',
    reason: 'GAP',
    priority: 'HIGH',
    version: 1,
    dismissReason: null,
    dismissedAt: null,
    parentQuestionId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    module: null,
    links: [],
    answers: [],
    ...overrides,
  };
}

describe('foldModuleCounts', () => {
  it('folds per-priority rows into one total per module, led by its most urgent priority', () => {
    expect(
      foldModuleCounts([
        { moduleId: 'm1', priority: 'NORMAL', count: 4 },
        { moduleId: 'm1', priority: 'CRITICAL', count: 1 },
        { moduleId: 'm1', priority: 'HIGH', count: 2 },
        { moduleId: null, priority: 'HIGH', count: 3 },
      ]),
    ).toEqual([
      { moduleId: 'm1', total: 7, mostUrgent: 'CRITICAL' },
      { moduleId: null, total: 3, mostUrgent: 'HIGH' },
    ]);
    expect(foldModuleCounts([])).toEqual([]);
  });
});

describe('questions.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.findQuestion.mockResolvedValue(record());
    queue.enqueueJob.mockResolvedValue('job');
  });

  describe('toQuestionDto', () => {
    it('renames content to text and carries follow-up parents', () => {
      expect(toQuestionDto(record({ parentQuestionId: 'q0' }) as never)).toMatchObject({
        text: 'Why?',
        followUpOf: 'q0',
        answer: null,
        dismissal: null,
      });
    });

    it('shows no answer for a question that is open again, even if old answers exist', () => {
      const answers = [
        {
          id: 'a',
          content: 'old',
          createdAt: new Date(),
          appliedAt: null,
          answeredBy: { id: 'u', name: 'U' },
        },
      ];
      expect(toQuestionDto(record({ status: 'OPEN', answers }) as never).answer).toBeNull();
    });

    it('falls back to the last update when a dismissal has no timestamp', () => {
      const dto = toQuestionDto(record({ status: 'DISMISSED', dismissReason: 'No' }) as never);
      expect(dto.dismissal).toEqual({ reason: 'No', at: '2026-01-02T00:00:00.000Z' });
    });

    it('skips link rows that point at nothing', () => {
      const dto = toQuestionDto(
        record({ links: [{ requirement: null, rule: null, module: null }] }) as never,
      );
      expect(dto.linkedItems).toEqual([]);
    });
  });

  describe('getCounts', () => {
    it('reports zero for statuses and priorities that have no rows', async () => {
      repo.countByStatus.mockResolvedValue([]);
      repo.countOpenByPriority.mockResolvedValue([]);
      expect(await getCounts(user, 'p1')).toEqual({
        byStatus: { OPEN: 0, ANSWERED: 0, DISMISSED: 0 },
        openByPriority: { CRITICAL: 0, HIGH: 0, NORMAL: 0 },
        openCritical: 0,
      });
    });
  });

  describe('answerQuestion', () => {
    const input = { answer: 'Yes', version: 1 };

    it('does not queue anything when the answer lost the race', async () => {
      repo.claimForAnswer.mockResolvedValue(false);
      repo.findConflictState.mockResolvedValue({
        status: 'ANSWERED',
        version: 2,
        dismissedBy: null,
        answers: [],
      });
      await expect(answerQuestion(user, 'p1', 'q1', input)).rejects.toMatchObject({
        statusCode: 409,
        message: 'This question was already answered. Refresh to see the latest.',
      });
      expect(repo.createAnswer).not.toHaveBeenCalled();
      expect(queue.enqueueJob).not.toHaveBeenCalled();
    });

    it('reports a vanished question as not found', async () => {
      repo.claimForAnswer.mockResolvedValue(false);
      repo.findConflictState.mockResolvedValue(null);
      await expect(answerQuestion(user, 'p1', 'q1', input)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('queues the apply-answer job after the answer is stored', async () => {
      repo.claimForAnswer.mockResolvedValue(true);
      repo.createAnswer.mockResolvedValue({ id: 'a1' });
      await answerQuestion(user, 'p1', 'q1', input);
      expect(repo.createAnswer).toHaveBeenCalledWith(
        {
          content: 'Yes',
          questionId: 'q1',
          answeredById: 'u1',
          projectId: 'p1',
          organizationId: 'o1',
        },
        {},
      );
      expect(queue.enqueueJob).toHaveBeenCalledWith('apply-answer', {
        organizationId: 'o1',
        projectId: 'p1',
        answerId: 'a1',
      });
    });

    it('still succeeds when queueing fails', async () => {
      repo.claimForAnswer.mockResolvedValue(true);
      repo.createAnswer.mockResolvedValue({ id: 'a1' });
      queue.enqueueJob.mockRejectedValue(new Error('down'));
      await expect(answerQuestion(user, 'p1', 'q1', input)).resolves.toMatchObject({ id: 'q1' });
    });
  });

  describe('dismissQuestion', () => {
    it('passes who dismissed it and when', async () => {
      repo.claimForDismissal.mockResolvedValue(true);
      await dismissQuestion(user, 'p1', 'q1', { reason: 'No longer needed', version: 3 });
      expect(repo.claimForDismissal.mock.calls[0]?.[0]).toMatchObject({
        organizationId: 'o1',
        projectId: 'p1',
        questionId: 'q1',
        version: 3,
        reason: 'No longer needed',
        dismissedById: 'u1',
      });
      expect(repo.claimForDismissal.mock.calls[0]?.[0].dismissedAt).toBeInstanceOf(Date);
    });

    it('explains a dismissal conflict with the person who got there first', async () => {
      repo.claimForDismissal.mockResolvedValue(false);
      repo.findConflictState.mockResolvedValue({
        status: 'DISMISSED',
        version: 2,
        dismissedBy: { name: 'Bob' },
        answers: [],
      });
      await expect(
        dismissQuestion(user, 'p1', 'q1', { reason: 'x', version: 1 }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'This question was already dismissed by Bob. Refresh to see the latest.',
      });
    });
  });
});
