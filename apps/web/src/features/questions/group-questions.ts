import { priorityRank, type QuestionDto } from '@brd/shared';
import { NO_MODULE_TITLE } from './question-labels';

export interface QuestionGroup {
  /** The module id, or "none" for questions that belong to no module. */
  key: string;
  title: string;
  questions: QuestionDto[];
}

const NO_MODULE = 'none';

function byUrgency(a: QuestionDto, b: QuestionDto): number {
  return (
    priorityRank(a.priority) - priorityRank(b.priority) || a.createdAt.localeCompare(b.createdAt)
  );
}

function mostUrgentRank(group: QuestionGroup): number {
  return Math.min(...group.questions.map((q) => priorityRank(q.priority)));
}

/**
 * Groups questions by module. Inside a group the most urgent comes first (oldest first on a tie);
 * groups are ordered by their most urgent question, then by name, with "General" last.
 */
export function groupQuestions(questions: QuestionDto[]): QuestionGroup[] {
  const groups = new Map<string, QuestionGroup>();
  for (const question of questions) {
    const key = question.module?.id ?? NO_MODULE;
    const group = groups.get(key) ?? {
      key,
      title: question.module?.name ?? NO_MODULE_TITLE,
      questions: [],
    };
    group.questions.push(question);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({ ...group, questions: [...group.questions].sort(byUrgency) }))
    .sort((a, b) => {
      if (a.key === NO_MODULE || b.key === NO_MODULE) return a.key === NO_MODULE ? 1 : -1;
      return mostUrgentRank(a) - mostUrgentRank(b) || a.title.localeCompare(b.title);
    });
}
