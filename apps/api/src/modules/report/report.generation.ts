import { reportLlmOutputSchema, type GenerateReportPayload } from '@brd/shared';
import type { DbClient } from '../../lib/transaction.js';
import { providerJsonSchema } from '../../services/llm/json-schema.js';
import { REPORT_MAX_OUTPUT_TOKENS } from '../../services/llm/output-limits.js';
import type { LlmService } from '../../services/llm/llm.service.js';
import { fingerprintItems } from './report.baseline.js';
import { buildReportContent, countItems, sanitizeNarrative } from './report.content.js';
import { reportInput } from './report.prompt-input.js';
import type { ReportRepository } from './report.repository.js';

export interface ReportGenerationDeps {
  repo: ReportRepository;
  llm: Pick<LlmService, 'run'>;
  transaction: <T>(fn: (tx: DbClient) => Promise<T>) => Promise<T>;
}

export type GenerateOutcome = 'generated' | 'skipped' | 'already-done';

/** The worker side of a report: writes the narrative and stores the finished version. */
export function createReportGeneration(deps: ReportGenerationDeps) {
  const { repo, llm, transaction } = deps;

  /** Job side: writes the report for a version that is waiting in GENERATING. */
  async function generateContent(payload: GenerateReportPayload): Promise<GenerateOutcome> {
    const { organizationId, projectId, reportVersionId } = payload;
    const version = await repo.findVersionById(organizationId, projectId, reportVersionId);
    if (!version) return 'skipped';
    if (version.status !== 'GENERATING') return 'already-done';

    const [name, summary] = await Promise.all([
      repo.projectName(organizationId, projectId),
      repo.latestSummary(organizationId, projectId),
    ]);
    if (name === null || summary === null) {
      await repo.failGeneration(
        organizationId,
        projectId,
        reportVersionId,
        'The project summary is missing',
      );
      return 'skipped';
    }
    const [items, openQuestions] = await Promise.all([
      repo.loadItems(organizationId, projectId),
      repo.loadOpenQuestions(organizationId, projectId),
    ]);

    const { output } = await llm.run({
      promptName: 'report',
      maxOutputTokens: REPORT_MAX_OUTPUT_TOKENS,
      user: reportInput({ projectName: name, summary, counts: countItems(items), openQuestions }),
      schema: reportLlmOutputSchema,
      outputJsonSchema: providerJsonSchema(reportLlmOutputSchema),
      context: { organizationId, projectId },
    });
    const content = buildReportContent({
      projectName: name,
      summary,
      items,
      openQuestions,
      narrative: sanitizeNarrative(output),
    });

    const stored = await transaction((tx) =>
      repo.completeGeneration(tx, {
        organizationId,
        projectId,
        id: reportVersionId,
        content,
        summaryVersion: summary.version,
        itemsFingerprint: fingerprintItems(items),
      }),
    );
    return stored ? 'generated' : 'already-done';
  }

  async function failGeneration(payload: GenerateReportPayload, reason: string): Promise<void> {
    const { organizationId, projectId, reportVersionId } = payload;
    await repo.failGeneration(organizationId, projectId, reportVersionId, reason);
  }

  return { generateContent, failGeneration };
}

export type ReportGeneration = ReturnType<typeof createReportGeneration>;
