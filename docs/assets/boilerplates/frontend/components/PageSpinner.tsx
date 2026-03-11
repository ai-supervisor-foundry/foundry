import React from 'react';
import { Loader2 } from 'lucide-react';

interface PageSpinnerProps {
  message?: string;
}

export const PageSpinner: React.FC<PageSpinnerProps> = ({ message = 'Loading...' }) => (
  <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 text-slate-500 transition-opacity duration-200" role="status" aria-live="polite">
    <Loader2 className="h-10 w-10 animate-spin text-indigo-600" aria-hidden />
    <p className="text-sm font-medium">{message}</p>
  </div>
);
