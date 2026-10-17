import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';

import { cn } from './lib/cn';

interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  size?: 'sm' | 'md';
  tone?: 'brand' | 'gray';
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, size = 'md', tone = 'brand', ...props }, ref) => {
  const isSm = size === 'sm';
  const iconCls = isSm ? 'h-2.5 w-2.5' : 'h-[11px] w-[11px]';
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'ring-offset-background focus-visible:ring-ring peer grid shrink-0 place-content-center rounded-[5px] border-[1.5px] transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        isSm ? 'h-3.5 w-3.5' : 'h-4 w-4',
        tone === 'gray'
          ? 'border-input text-primary-foreground data-[state=unchecked]:hover:border-muted-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary'
          : 'border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={cn('grid place-content-center text-current')}>
        {props.checked === 'indeterminate' ? (
          <Minus className={iconCls} strokeWidth={3} />
        ) : (
          <Check className={iconCls} strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
