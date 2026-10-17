import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from '@brd/ui';
import { errorMessage } from '@/lib/error-message';

type Resolvable<TData, TVars, TValue> = TValue | ((data: TData, variables: TVars) => TValue);

interface ApiMutationOptions<TData, TVars> {
  mutationFn: (variables: TVars) => Promise<TData>;
  /** Query keys to refresh after the request. */
  invalidate?: QueryKey[];
  /** Refresh after success only (default), or after any outcome. */
  invalidateOn?: 'success' | 'settled';
  /** Shown as a success toast. Leave out when the screen shows its own confirmation. */
  successMessage?: Resolvable<TData, TVars, string>;
  /**
   * Show the failure as a toast (default). Turn it off when the caller shows the error itself,
   * for example inline in a form or by handling a version conflict.
   */
  errorToast?: boolean;
}

function resolve<TData, TVars, TValue>(
  value: Resolvable<TData, TVars, TValue>,
  data: TData,
  variables: TVars,
): TValue {
  return typeof value === 'function'
    ? (value as (d: TData, v: TVars) => TValue)(data, variables)
    : value;
}

/** useMutation with the project's standard feedback: refresh affected queries and toast. */
export function useApiMutation<TData, TVars = void>({
  mutationFn,
  invalidate,
  invalidateOn = 'success',
  successMessage,
  errorToast = true,
}: ApiMutationOptions<TData, TVars>) {
  const queryClient = useQueryClient();

  const refresh = () =>
    Promise.all((invalidate ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })));

  return useMutation<TData, Error, TVars>({
    mutationFn,
    onSuccess: (data, variables) => {
      if (successMessage) toast.success(resolve(successMessage, data, variables));
      return invalidateOn === 'success' ? refresh() : undefined;
    },
    onError: (error) => {
      if (errorToast) toast.error(errorMessage(error));
    },
    onSettled: () => (invalidateOn === 'settled' ? refresh() : undefined),
  });
}
