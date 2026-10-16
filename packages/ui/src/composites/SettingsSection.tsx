import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from '../button';
import { Label } from '../label';

export function SettingsSection({
  title,
  subtitle,
  icon: Icon,
  headerExtra,
  dataSection,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  headerExtra?: React.ReactNode;
  dataSection?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section data-section={dataSection} className={cn('scroll-mt-4', className)}>
      <header className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-foreground text-xl font-medium">{title}</h2>
            {subtitle && <p className="text-muted-foreground text-lg">{subtitle}</p>}
          </div>
        </div>
        {headerExtra}
      </header>
      <div className="divide-border/60 divide-y">{children}</div>
    </section>
  );
}

export function SettingsField({
  label,
  id,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  error?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 py-3.5 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-start sm:gap-6">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-foreground text-lg font-medium">
          {label}
          {required && (
            <span className="text-destructive ml-0.5 font-bold" aria-hidden>
              *
            </span>
          )}
        </Label>
        {hint && !error && <p className="text-muted-foreground text-lg leading-snug">{hint}</p>}
      </div>
      <div className="min-w-0 sm:max-w-xl">
        <div className={error ? 'ring-destructive/30 rounded-lg ring-2' : undefined}>{children}</div>
        {error && (
          <p role="alert" className="text-destructive mt-1 flex items-center gap-1 text-lg font-medium">
            <span className="bg-destructive inline-block h-1 w-1 rounded-full" />
            {label} is required
          </p>
        )}
      </div>
    </div>
  );
}

export function SettingsSaveBar({
  onDiscard,
  onSave,
  disabled,
  saving,
  saveLabel = 'Save changes',
  className,
}: {
  onDiscard: () => void;
  onSave: () => void;
  disabled?: boolean;
  saving?: boolean;
  saveLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-surface/90 supports-[backdrop-filter]:bg-surface/75 sticky bottom-0 z-30 mt-auto shrink-0 border-t px-5 py-3 backdrop-blur',
        className,
      )}
    >
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDiscard} disabled={disabled || saving}>
          Discard
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={disabled || saving}>
          {saving ? 'Saving\u2026' : saveLabel}
        </Button>
      </div>
    </div>
  );
}
