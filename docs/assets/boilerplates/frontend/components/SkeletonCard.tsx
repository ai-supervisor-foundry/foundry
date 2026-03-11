import React from 'react';

interface SkeletonCardProps {
  variant?: 'timesheet-row' | 'project-row' | 'stat';
  count?: number;
}

const SkeletonLine: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`h-4 rounded bg-slate-200 animate-pulse ${className}`} />
);

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ variant = 'timesheet-row', count = 1 }) => {
  if (variant === 'timesheet-row') {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 p-4 md:p-6">
            <SkeletonLine className="w-12" />
            <SkeletonLine className="flex-1 max-w-[140px]" />
            <SkeletonLine className="flex-1 max-w-[120px]" />
            <SkeletonLine className="w-16" />
            <SkeletonLine className="w-14" />
          </div>
        ))}
      </>
    );
  }
  if (variant === 'project-row') {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 p-4 md:p-6">
            <SkeletonLine className="w-14" />
            <SkeletonLine className="flex-1 max-w-[180px]" />
            <SkeletonLine className="w-24" />
            <SkeletonLine className="w-24" />
            <SkeletonLine className="w-16 rounded-full" />
          </div>
        ))}
      </>
    );
  }
  return null;
};
