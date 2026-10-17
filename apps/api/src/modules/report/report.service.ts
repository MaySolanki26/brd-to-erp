import {
  type ApproveReportInput,
  type ApproveWithConditionsInput,
  type ApprovalDecision,
  type GenerateReportPayload,
  type RejectReportInput,
  type ReportDecisionDto,
  type ReportReadinessDto,
  type ReportVersionDto,
  type ReportVersionStatus,
  type ReportVersionSummaryDto,
  type UpdateConditionInput,
  type UserDto,
} from '@brd/shared';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../errors/app-error.js';
import { logger } from '../../lib/logger.js';
import type { DbClient } from '../../lib/transaction.js';
import type { createAuditLog } from '../audit/audit.repository.js';
import { buildBaseline, fingerprintItems } from './report.baseline.js';
import type { ReportRepository, VersionRecord } from './report.repository.js';

export interface ReportDeps {
  repo: ReportRepository;
  transaction: <T>(fn: (tx: DbClient) => Promise<T>) => Promise<T>;
  audit: typeof createAuditLog;
  /** Queues the job that writes a report. */
  enqueueGeneration: (payload: GenerateReportPayload) => Promise<void>;
}

export function createReportService(deps: ReportDeps) {
  const { repo, transaction, audit, enqueueGeneration } = deps;

  async function readiness(user: UserDto, projectId: string): Promise<ReportReadinessDto> {
    const { organizationId } = user;
    const [blockingQuestions, summary] = await Promise.all([
      repo.findBlockingQuestions(organizationId, projectId),
      repo.latestSummary(organizationId, projectId),
    ]);
    return {
      ready: blockingQuestions.length === 0 && summary !== null,
      blockingQuestions,
      hasSummary: summary !== null,
    };
  }

  /** A report cannot be written, submitted or approved while a critical question is open. */
  async function assertNoBlockingQuestions(organizationId: string, projectId: string) {
    const blocking = await repo.findBlockingQuestions(organizationId, projectId);
    if (blocking.length > 0) {
      throw new ConflictError(
        `${blocking.length} critical question${blocking.length === 1 ? ' is' : 's are'} still open. Answer or dismiss them first.`,
      );
    }
  }

  /**
   * Approved versions whose items have changed since the approval become OUTDATED. Returns the ids
   * that were just marked.
   */
  async function refreshOutdated(organizationId: string, projectId: string): Promise<Set<string>> {
    const baselines = await repo.findApprovedBaselines(organizationId, projectId);
    if (baselines.length === 0) return new Set();
    const fingerprint = fingerprintItems(await repo.loadItems(organizationId, projectId));
    const marked = new Set<string>();
    for (const baseline of baselines) {
      if (baseline.baselineFingerprint === fingerprint) continue;
      await transaction(async (tx) => {
        if (!(await repo.markOutdated(tx, organizationId, projectId, baseline.versionId))) return;
        marked.add(baseline.versionId);
        await audit(
          {
            action: 'UPDATE',
            entity: 'ReportVersion',
            entityId: baseline.versionId,
            organizationId,
            metadata: { projectId, version: baseline.version, status: 'OUTDATED' },
          },
          tx,
        );
      });
    }
    return marked;
  }

  const toDecision = (record: VersionRecord): ReportDecisionDto | null =>
    record.approval && {
      decision: record.approval.decision,
      comment: record.approval.comment,
      decidedBy: record.approval.decidedBy,
      decidedAt: record.approval.decidedAt.toISOString(),
      baselineHash: record.approval.baselineHash,
      conditions: record.approval.conditions.map((c) => ({
        id: c.id,
        text: c.text,
        status: c.status,
        updatedBy: c.updatedBy,
        metAt: c.metAt?.toISOString() ?? null,
      })),
    };

  function toSummaryDto(
    record: VersionRecord,
    latest: number,
    outdated: Set<string>,
  ): ReportVersionSummaryDto {
    const nowOutdated = outdated.has(record.id);
    return {
      version: record.version,
      status: nowOutdated ? 'OUTDATED' : record.status,
      isLatest: record.version === latest,
      summaryVersion: record.summaryVersion,
      failureReason: record.failureReason,
      createdBy: record.createdBy,
      createdAt: record.createdAt.toISOString(),
      submittedBy: record.submittedBy,
      submittedAt: record.submittedAt?.toISOString() ?? null,
      outdatedAt: nowOutdated
        ? new Date().toISOString()
        : (record.outdatedAt?.toISOString() ?? null),
      decision: record.approval && {
        decision: record.approval.decision,
        decidedAt: record.approval.decidedAt.toISOString(),
      },
    };
  }

  async function listVersions(
    user: UserDto,
    projectId: string,
  ): Promise<ReportVersionSummaryDto[]> {
    const outdated = await refreshOutdated(user.organizationId, projectId);
    const records = await repo.listVersions(user.organizationId, projectId);
    const latest = records[0]?.version ?? 0;
    return records.map((r) => toSummaryDto(r, latest, outdated));
  }

  async function requireVersion(
    organizationId: string,
    projectId: string,
    version: number,
  ): Promise<VersionRecord> {
    const record = await repo.findVersion(organizationId, projectId, version);
    if (!record) throw new NotFoundError('Report version not found');
    return record;
  }

  async function getVersion(
    user: UserDto,
    projectId: string,
    version: number,
  ): Promise<ReportVersionDto> {
    const outdated = await refreshOutdated(user.organizationId, projectId);
    const record = await requireVersion(user.organizationId, projectId, version);
    const latest =
      (await repo.latestVersionNumber(user.organizationId, projectId)) ?? record.version;
    return {
      ...toSummaryDto(record, latest, outdated),
      content: record.content ?? null,
      decisionDetail: toDecision(record),
    };
  }

  async function generate(user: UserDto, projectId: string): Promise<{ version: number }> {
    const { organizationId } = user;
    const state = await readiness(user, projectId);
    if (!state.hasSummary) {
      throw new ConflictError('The project summary is not ready yet. Process the sources first.');
    }
    await assertNoBlockingQuestions(organizationId, projectId);

    const created = await transaction(async (tx) => {
      await repo.lockProject(tx, organizationId, projectId);
      const latestNumber = await repo.latestVersionNumber(organizationId, projectId, tx);
      if (latestNumber !== null) {
        const latest = await repo.findVersion(organizationId, projectId, latestNumber);
        if (latest?.status === 'GENERATING') {
          throw new ConflictError('A report is already being written. Wait for it to finish.');
        }
      }
      const version = await repo.createVersion(tx, { organizationId, projectId, userId: user.id });
      await audit(
        {
          action: 'CREATE',
          entity: 'ReportVersion',
          entityId: version.id,
          userId: user.id,
          organizationId,
          metadata: { projectId, version: version.version },
        },
        tx,
      );
      return version;
    });

    try {
      await enqueueGeneration({ organizationId, projectId, reportVersionId: created.id });
    } catch (err) {
      logger.error({ err, projectId, version: created.version }, 'Could not queue generate-report');
      await repo.failGeneration(organizationId, projectId, created.id, 'Could not be started');
      throw new ServiceUnavailableError('Could not start the report. Try again shortly.');
    }
    return { version: created.version };
  }

  /** Only the newest version moves on, and only if the project still matches what it describes. */
  async function requireCurrent(
    user: UserDto,
    projectId: string,
    record: VersionRecord,
    expected: ReportVersionStatus,
    action: string,
    options: { requireFresh: boolean } = { requireFresh: true },
  ): Promise<void> {
    const { organizationId } = user;
    const latest = await repo.latestVersionNumber(organizationId, projectId);
    if (latest !== record.version) {
      throw new ConflictError(`Only the newest report version can be ${action}.`);
    }
    if (record.status !== expected) {
      throw new ConflictError(
        `This report is ${record.status.toLowerCase().replace(/_/g, ' ')}, so it cannot be ${action}.`,
      );
    }
    if (!options.requireFresh) return;
    const fingerprint = fingerprintItems(await repo.loadItems(organizationId, projectId));
    if (fingerprint !== record.itemsFingerprint) {
      throw new ConflictError(
        'Requirements, rules or modules changed since this report was written. Generate a new version.',
      );
    }
  }

  async function submit(user: UserDto, projectId: string, version: number): Promise<void> {
    const { organizationId } = user;
    const record = await requireVersion(organizationId, projectId, version);
    await requireCurrent(user, projectId, record, 'DRAFT', 'submitted');
    await assertNoBlockingQuestions(organizationId, projectId);
    await transaction(async (tx) => {
      const ok = await repo.submitVersion(tx, {
        organizationId,
        projectId,
        id: record.id,
        userId: user.id,
      });
      if (!ok) throw new ConflictError('This report was already submitted.');
      await audit(
        {
          action: 'UPDATE',
          entity: 'ReportVersion',
          entityId: record.id,
          userId: user.id,
          organizationId,
          metadata: { projectId, version, status: 'SUBMITTED' },
        },
        tx,
      );
    });
  }

  /** The person who submitted a report cannot decide it, unless they are the project's only owner. */
  async function assertNotSelfApproval(
    user: UserDto,
    projectId: string,
    record: VersionRecord,
  ): Promise<void> {
    if (record.submittedBy?.id !== user.id) return;
    const owners = await repo.listOwnerIds(user.organizationId, projectId);
    const soleOwner = owners.length === 1 && owners[0] === user.id;
    if (!soleOwner) {
      throw new ForbiddenError('You submitted this report, so someone else has to decide on it.');
    }
  }

  async function decide(
    user: UserDto,
    projectId: string,
    version: number,
    input: { decision: ApprovalDecision; comment: string | null; conditions: string[] },
  ): Promise<void> {
    const { organizationId } = user;
    const record = await requireVersion(organizationId, projectId, version);
    // A report that no longer matches the project cannot be approved, but it can still be rejected
    // so it does not stay pending forever.
    await requireCurrent(user, projectId, record, 'SUBMITTED', 'decided', {
      requireFresh: input.decision !== 'REJECTED',
    });
    await assertNotSelfApproval(user, projectId, record);

    if (input.decision !== 'REJECTED') await assertNoBlockingQuestions(organizationId, projectId);

    const criticalOpen = (await repo.findBlockingQuestions(organizationId, projectId)).length;
    const [items, sources, openQuestions] = await Promise.all([
      repo.loadItems(organizationId, projectId),
      repo.loadSourceVersions(organizationId, projectId),
      repo.loadOpenQuestions(organizationId, projectId),
    ]);
    const baseline = buildBaseline({
      takenAt: new Date(),
      summaryVersion: record.summaryVersion,
      items,
      sources,
      openQuestions: { total: openQuestions.total, critical: criticalOpen },
    });

    await transaction(async (tx) => {
      const approvalId = await repo.recordDecision(tx, {
        organizationId,
        projectId,
        versionId: record.id,
        decision: input.decision,
        comment: input.comment,
        decidedById: user.id,
        baseline: {
          snapshot: baseline.snapshot,
          hash: baseline.hash,
          fingerprint: baseline.fingerprint,
        },
        conditions: input.conditions,
      });
      if (approvalId === null) throw new ConflictError('This report was already decided.');
      await audit(
        {
          action: input.decision === 'REJECTED' ? 'REJECT' : 'APPROVE',
          entity: 'Approval',
          entityId: approvalId,
          userId: user.id,
          organizationId,
          metadata: {
            projectId,
            reportVersionId: record.id,
            version,
            decision: input.decision,
            conditions: input.conditions.length,
            baselineHash: baseline.hash,
          },
        },
        tx,
      );
    });
  }

  const approve = (user: UserDto, projectId: string, version: number, input: ApproveReportInput) =>
    decide(user, projectId, version, {
      decision: 'APPROVED',
      comment: input.comment ?? null,
      conditions: [],
    });

  const reject = (user: UserDto, projectId: string, version: number, input: RejectReportInput) =>
    decide(user, projectId, version, {
      decision: 'REJECTED',
      comment: input.reason,
      conditions: [],
    });

  const approveWithConditions = (
    user: UserDto,
    projectId: string,
    version: number,
    input: ApproveWithConditionsInput,
  ) =>
    decide(user, projectId, version, {
      decision: 'APPROVED_WITH_CONDITIONS',
      comment: input.comment ?? null,
      conditions: input.conditions.map((c) => c.text),
    });

  async function updateCondition(
    user: UserDto,
    projectId: string,
    version: number,
    conditionId: string,
    input: UpdateConditionInput,
  ): Promise<void> {
    const { organizationId } = user;
    const condition = await repo.findCondition(organizationId, projectId, version, conditionId);
    if (!condition) throw new NotFoundError('Condition not found');
    if (condition.versionStatus !== 'APPROVED_WITH_CONDITIONS') {
      throw new ConflictError('Conditions can only change while the approval is in force.');
    }
    await transaction(async (tx) => {
      await repo.updateCondition(tx, {
        organizationId,
        id: conditionId,
        userId: user.id,
        text: input.text,
        status: input.status,
      });
      await audit(
        {
          action: 'UPDATE',
          entity: 'ApprovalCondition',
          entityId: conditionId,
          userId: user.id,
          organizationId,
          metadata: {
            projectId,
            version,
            ...(input.status && { status: input.status }),
            textChanged: input.text !== undefined,
          },
        },
        tx,
      );
    });
  }

  return {
    readiness,
    generate,
    listVersions,
    getVersion,
    submit,
    approve,
    reject,
    approveWithConditions,
    updateCondition,
    refreshOutdated: (organizationId: string, projectId: string) =>
      refreshOutdated(organizationId, projectId).then((ids) => ids.size),
  };
}

export type ReportService = ReturnType<typeof createReportService>;
