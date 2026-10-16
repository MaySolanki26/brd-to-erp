import React from 'react';
import toastLib, { Toaster } from 'react-hot-toast';
import type { Toast } from 'react-hot-toast';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from './lib/cn';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastMessage {
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: ToastAction;
}

type ShowArgs =
  | string
  | {
      title: string;
      description?: string;
      duration?: number;
      id?: string;
      /** A text button (e.g. "Undo") that runs `onClick` and then dismisses the toast. */
      action?: ToastAction;
    };

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; bg: string; border: string; iconColor: string }
> = {
  success: {
    icon: <CheckCircle size={18} strokeWidth={1.5} />,
    bg: 'bg-[rgb(var(--success-light))]',
    border: 'border-[rgb(var(--success)_/_0.3)]',
    iconColor: 'text-[rgb(var(--success))]',
  },
  error: {
    icon: <XCircle size={18} strokeWidth={1.5} />,
    bg: 'bg-[rgb(var(--destructive-light))]',
    border: 'border-[rgb(var(--destructive)_/_0.3)]',
    iconColor: 'text-[rgb(var(--destructive))]',
  },
  warning: {
    icon: <AlertTriangle size={18} strokeWidth={1.5} />,
    bg: 'bg-[rgb(var(--warning-light))]',
    border: 'border-[rgb(var(--warning)_/_0.3)]',
    iconColor: 'text-[rgb(var(--warning))]',
  },
  info: {
    icon: <Info size={18} strokeWidth={1.5} />,
    bg: 'bg-[rgb(var(--info-light))]',
    border: 'border-[rgb(var(--info)_/_0.3)]',
    iconColor: 'text-[rgb(var(--info))]',
  },
};

function renderToast(msg: ToastMessage) {
  return (t: Toast) => {
    const config = variantConfig[msg.variant];

    // Let react-hot-toast's <Toaster> handle enter/exit positioning.
    // We only control opacity so the two animation layers don't conflict
    // and create a "double toast" visual.
    return (
      <div
        // Lets a modal layer tell a click on a toast (e.g. its action) from an outside click.
        data-toast-root=""
        className={`${t.visible ? 'opacity-100' : 'opacity-0'} pointer-events-auto flex w-fit max-w-[400px] items-start gap-3 rounded-[var(--radius-lg)] border transition-opacity duration-200 ${config.bg} ${config.border} px-4 py-3 shadow-[var(--shadow-lg)]`}
      >
        <div className={`mt-0.5 flex-shrink-0 ${config.iconColor}`}>{config.icon}</div>
        <div className="flex flex-col gap-0.5 pr-2">
          <p className="text-foreground text-xl font-medium">{msg.title}</p>
          {msg.description ? (
            <p className="text-muted-foreground text-lg">{msg.description}</p>
          ) : null}
        </div>
        {msg.action ? (
          <button
            type="button"
            onClick={() => {
              msg.action?.onClick();
              toastLib.dismiss(t.id);
            }}
            className={cn(
              'text-primary hover:text-primary/80 ml-auto flex-shrink-0 rounded-md px-1.5 py-0.5 text-lg font-medium transition-colors',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
            )}
          >
            {msg.action.label}
          </button>
        ) : null}
        <button
          onClick={() => toastLib.dismiss(t.id)}
          className={cn(
            'text-muted-foreground hover:text-foreground mt-0.5 flex-shrink-0 rounded-md p-0.5 transition-colors',
            !msg.action && 'ml-auto',
          )}
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    );
  };
}

// Global toast-style API compatible with toast.success(...)
export const toast = {
  show(variant: ToastVariant, args: ShowArgs, description?: string, duration?: number) {
    const payload: ToastMessage =
      typeof args === 'string'
        ? { title: args, description, variant }
        : { title: args.title, description: args.description, variant, action: args.action };

    const dur = typeof args === 'string' ? (duration ?? 3000) : (args.duration ?? 3000);
    // Deterministic id prevents accidental duplicates from rapid re-renders
    const id = typeof args !== 'string' && args.id ? args.id : `${variant}-${payload.title}`;

    return toastLib.custom(renderToast(payload), { duration: dur, id });
  },
  success(args: ShowArgs, description?: string, duration?: number) {
    return this.show('success', args, description, duration);
  },
  error(args: ShowArgs, description?: string, duration?: number) {
    return this.show('error', args, description, duration);
  },
  warning(args: ShowArgs, description?: string, duration?: number) {
    return this.show('warning', args, description, duration);
  },
  info(args: ShowArgs, description?: string, duration?: number) {
    return this.show('info', args, description, duration);
  },
  dismiss(id?: string) {
    return id ? toastLib.dismiss(id) : toastLib.dismiss();
  },
};

// Backward-compatible context API used across the app
const ToastContext = React.createContext<{
  notify: (msg: ToastMessage & { duration?: number; id?: string }) => void;
} | null>(null);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const notify = (msg: ToastMessage & { duration?: number; id?: string }) => {
    const toastId = msg.id ?? `${msg.variant}-${msg.title}`;
    toastLib.custom(renderToast(msg), {
      duration: msg.duration ?? 3000,
      id: toastId,
    });
  };

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <Toaster
        position="top-right"
        gutter={8}
        containerStyle={{ zIndex: 9999 }}
        toastOptions={{ duration: 3000 }}
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx.notify;
};
