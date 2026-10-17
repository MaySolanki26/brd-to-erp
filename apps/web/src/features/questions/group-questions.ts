import { priorityRank, type QuestionDto, type QuestionModuleCountDto } from '@brd/shared';
import { NO_MODULE_TITLE } from './question-labels';

export interface QuestionGroup {
  /** The module id, or "none" for questions that belong to no module. */
  key: string;
  title: string;
  /** The questions loaded so far, most urgent first. */
  questions: QuestionDto[];
  /** How many questions match the filters in this module, loaded or not. */
  total: number;
}

const NO_MODULE = 'none';

function byUrgency(a: QuestionDto, b: QuestionDto): number {
  return (
    priorityRank(a.priority) - priorityRank(b.priority) || a.createdAt.localeCompare(b.createdAt)
  );
}

function mostUrgentRank(group: QuestionGroup, counts: Map<string, QuestionModuleCountDto>): number {
  const known = counts.get(group.key);
  if (known) return priorityRank(known.mostUrgent);
  return Math.min(...group.questions.map((q) => priorityRank(q.priority)));
}

/**
 * Groups questions by module. Inside a group the most urgent comes first (oldest first on a tie);
 * groups are ordered by their most urgent question, then by name, with "General" last.
 *
 * `moduleCounts` come from the server and cover every page, so a group reports its true size and
 * keeps its place while more pages load. Without them the loaded questions are all that is known.
 */
export function groupQuestions(
  questions: QuestionDto[],
  moduleCounts: QuestionModuleCountDto[] = [],
): QuestionGroup[] {
  const counts = new Map(moduleCounts.map((c) => [c.moduleId ?? NO_MODULE, c]));
  const groups = new Map<string, QuestionGroup>();
  for (const question of questions) {
    const key = question.module?.id ?? NO_MODULE;
    const group = groups.get(key) ?? {
      key,
      title: question.module?.name ?? NO_MODULE_TITLE,
      questions: [],
      total: 0,
    };
    group.questions.push(question);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      questions: [...group.questions].sort(byUrgency),
      total: Math.max(counts.get(group.key)?.total ?? 0, group.questions.length),
    }))
    .sort((a, b) => {
      if (a.key === NO_MODULE || b.key === NO_MODULE) return a.key === NO_MODULE ? 1 : -1;
      return (
        mostUrgentRank(a, counts) - mostUrgentRank(b, counts) || a.title.localeCompare(b.title)
      );
    });
}
