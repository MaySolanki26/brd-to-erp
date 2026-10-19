import * as React from 'react';

import { cn } from './lib/cn';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea className={cn('uab-input uab-textarea', className)} ref={ref} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
