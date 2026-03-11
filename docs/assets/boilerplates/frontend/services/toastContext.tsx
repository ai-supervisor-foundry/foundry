import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  onRetry?: () => void;
}

const DISMISS_MS = 5000;
export const TOAST_DURATION_LONG_MS = 8000;

type ToastContextType = {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, options?: { onRetry?: () => void; duration?: number }) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `toast-${idCounter}-${Date.now()}`;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) clearTimeout(t);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, options?: { onRetry?: () => void; duration?: number }) => {
      const id = nextId();
      const toast: Toast = { id, type, message, onRetry: options?.onRetry };
      setToasts((prev) => [...prev, toast]);
      const duration = options?.duration ?? DISMISS_MS;
      const t = setTimeout(() => removeToast(id), duration);
      timersRef.current.set(id, t);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
