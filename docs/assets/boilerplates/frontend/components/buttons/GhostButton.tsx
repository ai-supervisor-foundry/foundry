import React from 'react';
import { useThrottledClick } from './useThrottledClick';
import { BUTTON_GHOST_VARIANTS, BUTTON_THROTTLE_MS } from '../../theme/buttons';

export type GhostButtonVariant = keyof typeof BUTTON_GHOST_VARIANTS;

export interface GhostButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  throttleMs?: number;
  variant?: GhostButtonVariant;
  disabled?: boolean;
  className?: string;
  id?: string;
  role?: string;
  'aria-label'?: string;
  title?: string;
  children?: React.ReactNode;
}

export const GhostButton: React.FC<GhostButtonProps> = ({
  onClick,
  throttleMs = BUTTON_THROTTLE_MS,
  variant = 'default',
  disabled,
  className = '',
  id,
  role,
  'aria-label': ariaLabel,
  title,
  children,
}) => {
  const throttledOnClick = useThrottledClick(onClick, throttleMs);

  return (
    <button
      type="button"
      onClick={throttledOnClick}
      disabled={disabled}
      id={id}
      role={role}
      aria-label={ariaLabel}
      title={title}
      className={`font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_GHOST_VARIANTS[variant]} ${className}`.trim()}
    >
      {children}
    </button>
  );
};
