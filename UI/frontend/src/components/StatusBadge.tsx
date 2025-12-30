// StatusBadge Component
// Color-coded status indicator


type SupervisorStatus = 'RUNNING' | 'HALTED' | 'BLOCKED' | 'COMPLETED';

interface StatusBadgeProps {
  status: SupervisorStatus | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

const statusColors: Record<SupervisorStatus, string> = {
  RUNNING: 'bg-green-500',
  HALTED: 'bg-red-500',
  BLOCKED: 'bg-yellow-500',
  COMPLETED: 'bg-blue-500',
};

const statusLabels: Record<SupervisorStatus, string> = {
  RUNNING: 'Running',
  HALTED: 'Halted',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
};

const sizeClasses = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-1.5',
  lg: 'text-base px-4 py-2',
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  if (!status) {
    return (
      <span className={`inline-flex items-center rounded-full bg-gray-500 ${sizeClasses[size]}`}>
        Unknown
      </span>
    );
  }

  const colorClass = statusColors[status];
  const label = statusLabels[status];

  return (
    <span className={`inline-flex items-center rounded-full text-white ${colorClass} ${sizeClasses[size]}`}>
      {label}
    </span>
  );
}

