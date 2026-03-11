import React from 'react';
import { useThrottledClick } from './useThrottledClick';
import {
  BUTTON_ICON_SIZE,
  BUTTON_ICON_VARIANTS,
  BUTTON_THROTTLE_MS,
} from '../../theme/buttons';

export type IconButtonVariant = keyof typeof BUTTON_ICON_VARIANTS;

export interface IconButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  throttleMs?: number;
  variant?: IconButtonVariant;
  disabled?: boolean;
  className?: string;
  'aria-label': string;
  id?: string;
  role?: string;
  title?: string;
  children?: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  throttleMs = BUTTON_THROTTLE_MS,
  variant = 'default',
  disabled,
  className = '',
  'aria-label': ariaLabel,
  id,
  role,
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
      title={title ?? ariaLabel}
      className={`${BUTTON_ICON_SIZE} flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-2 ${BUTTON_ICON_VARIANTS[variant]} ${className}`.trim()}
    >
      {children}
    </button>
  );
};
