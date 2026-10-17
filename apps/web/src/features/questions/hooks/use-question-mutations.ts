import { useQueryClient } from '@tanstack/react-query';
import type { AnswerQuestionInput, DismissQuestionInput, QuestionDto } from '@brd/shared';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

/** Anything a question change can affect: the lists, the counts, the timeline and the summary. */
function questionDataKeys(projectId: string) {
  return [
    queryKeys.projects.questionsAll(projectId),
    queryKeys.projects.decisions(projectId),
    queryKeys.projects.summaryAll(projectId),
  ];
}

// The question card handles errors itself: a version conflict keeps the draft, others show inline.
export function useAnswerQuestion(projectId: string) {
  return useApiMutation({
    mutationFn: async ({ questionId, ...input }: AnswerQuestionInput & { questionId: string }) =>
      (
        await apiClient.post<{ question: QuestionDto }>(
          `/projects/${projectId}/questions/${questionId}/answer`,
          input,
        )
      ).question,
    invalidate: questionDataKeys(projectId),
    errorToast: false,
  });
}

export function useDismissQuestion(projectId: string) {
  return useApiMutation({
    mutationFn: async ({ questionId, ...input }: DismissQuestionInput & { questionId: string }) =>
      (
        await apiClient.post<{ question: QuestionDto }>(
          `/projects/${projectId}/questions/${questionId}/dismiss`,
          input,
        )
      ).question,
    invalidate: questionDataKeys(projectId),
    errorToast: false,
  });
}

/** Reloads the lists and counts, for example after a conflict. */
export function useRefreshQuestions(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.questionsAll(projectId) });
}
