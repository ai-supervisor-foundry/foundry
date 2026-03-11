import React from 'react';
import { useToast } from '../services/toastContext';
import { CheckCircle, XCircle, AlertTriangle, Info, RefreshCw } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles: Record<string, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-sky-50 border-sky-200 text-sky-800',
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2 pointer-events-auto">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          const style = styles[t.type];
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg ${style}`}
              role="alert"
            >
              <Icon className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.message}</p>
                {t.onRetry && (
                  <button
                    type="button"
                    onClick={() => {
                      t.onRetry?.();
                      removeToast(t.id);
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline focus:outline-none focus:ring-2 focus:ring-offset-1 rounded"
                  >
                    <RefreshCw className="w-4 h-4" /> Retry
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-1 rounded hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1"
                aria-label="Dismiss"
              >
                <span className="sr-only">Dismiss</span>
                <span aria-hidden>×</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
