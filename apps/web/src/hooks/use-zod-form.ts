import { useForm, type UseFormProps, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

export function useZodForm<TValues extends FieldValues>(
  schema: z.ZodType<TValues, TValues>,
  props?: Omit<UseFormProps<TValues>, 'resolver'>,
) {
  return useForm<TValues>({
    ...props,
    resolver: zodResolver(schema),
  });
}
