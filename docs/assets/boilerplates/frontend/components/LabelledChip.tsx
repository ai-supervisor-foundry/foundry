import React from 'react';

export interface LabelledChipProps {
  label: string;
  value: string;
  className?: string;
}

/** Reusable chip: left label (max 1/5th), right value (stretches). Slightly rounded, slate styling. */
export const LabelledChip: React.FC<LabelledChipProps> = ({
  label,
  value,
  className = '',
}) => (
  <div
    className={`flex items-center w-full min-w-0 rounded-md border border-slate-200 bg-slate-100 overflow-hidden ${className}`}
  >
    <span className="px-2 py-1.5 text-slate-500 text-xs font-medium shrink-0 max-w-[20%] truncate">
      {label}
    </span>
    <span className="flex-1 px-2 py-1.5 text-slate-700 text-sm font-medium truncate">
      {value}
    </span>
  </div>
);
