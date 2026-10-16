import { Check } from 'lucide-react';
import { cn } from './lib/cn';

export type StepperStep = { key: string; label: string };

export type StepperProps = {
  steps: StepperStep[];
  currentIndex: number;
  completedKeys: Set<string>;
  className?: string;
};

type StepState = 'completed' | 'current' | 'upcoming';

function getStepState(
  index: number,
  step: StepperStep,
  currentIndex: number,
  completedKeys: Set<string>,
): StepState {
  if (completedKeys.has(step.key)) return 'completed';
  if (index === currentIndex) return 'current';
  return 'upcoming';
}

export function Stepper({ steps, currentIndex, completedKeys, className }: StepperProps) {
  return (
    <ol
      className={cn('flex w-full items-center justify-center gap-2 sm:gap-4', className)}
      aria-label="Setup progress"
    >
      {steps.map((step, index) => {
        const state = getStepState(index, step, currentIndex, completedKeys);
        const isLast = index === steps.length - 1;
        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                data-testid={`stepper-circle-${step.key}`}
                data-state={state}
                aria-current={state === 'current' ? 'step' : undefined}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xl font-medium ring-1 ring-inset transition-colors',
                  state === 'completed' && 'bg-primary text-primary-foreground ring-primary',
                  state === 'current' && 'bg-primary/10 text-primary ring-primary',
                  state === 'upcoming' && 'bg-muted text-muted-foreground ring-border',
                )}
              >
                {state === 'completed' ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
              </div>
              <span
                className={cn(
                  'whitespace-nowrap text-lg',
                  state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground font-medium',
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                aria-hidden
                className={cn(
                  'mx-2 h-px flex-1 sm:mx-4',
                  completedKeys.has(step.key) ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
