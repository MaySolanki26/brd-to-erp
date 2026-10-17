import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AnswerQuestionInput, DismissQuestionInput, QuestionDto } from '@brd/shared';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

/** Anything a question change can affect: the lists, the counts, the timeline and the summary. */
function useRefreshQuestionData(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [
        queryKeys.projects.questionsAll(projectId),
        queryKeys.projects.decisions(projectId),
        queryKeys.projects.summaryAll(projectId),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}

export function useAnswerQuestion(projectId: string) {
  const refresh = useRefreshQuestionData(projectId);
  return useMutation({
    mutationFn: async ({ questionId, ...input }: AnswerQuestionInput & { questionId: string }) =>
      (
        await apiClient.post<{ question: QuestionDto }>(
          `/projects/${projectId}/questions/${questionId}/answer`,
          input,
        )
      ).question,
    onSuccess: refresh,
  });
}

export function useDismissQuestion(projectId: string) {
  const refresh = useRefreshQuestionData(projectId);
  return useMutation({
    mutationFn: async ({ questionId, ...input }: DismissQuestionInput & { questionId: string }) =>
      (
        await apiClient.post<{ question: QuestionDto }>(
          `/projects/${projectId}/questions/${questionId}/dismiss`,
          input,
        )
      ).question,
    onSuccess: refresh,
  });
}

/** Reloads the lists and counts, for example after a conflict. */
export function useRefreshQuestions(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.questionsAll(projectId) });
}
