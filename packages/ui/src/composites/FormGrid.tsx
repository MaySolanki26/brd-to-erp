import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

/**
 * Form fields flow 1 → 2 → 3 per row from the available width (each column at least 220px, at most
 * three): a 560px drawer shows two, a wide page three, a phone one. Long fields use `FormGridItem full`.
 */
export function FormGrid({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('uab-form-grid', className)} {...props} />;
}

export interface FormGridItemProps extends ComponentProps<'div'> {
  /** Takes the whole row: long text, line items, multi-selects. */
  full?: boolean;
}

export function FormGridItem({ full = false, className, ...props }: FormGridItemProps) {
  return <div className={cn('uab-form-field', full && 'uab-span-all', className)} {...props} />;
}
