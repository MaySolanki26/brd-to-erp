import * as React from 'react';

import { cn } from './lib/cn';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const VARIANT_TONE: Record<BadgeVariant, string> = {
  default: 'uab-tone-accent',
  secondary: 'uab-tone-neutral',
  destructive: 'uab-tone-danger',
  outline: 'uab-tone-neutral',
};

/** Small label: the template's `badge` with a tone (accent, neutral, danger). */
function badgeVariants(options: { variant?: BadgeVariant | null } = {}): string {
  return cn('uab-badge', VARIANT_TONE[options.variant ?? 'default']);
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant | null;
}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
