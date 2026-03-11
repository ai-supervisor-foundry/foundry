import React from 'react';
import { useThrottledClick } from './useThrottledClick';
import {
  BUTTON_MIN_HEIGHT,
  BUTTON_BASE,
  BUTTON_SUCCESS,
  BUTTON_WIDTH,
  BUTTON_THROTTLE_MS,
} from '../../theme/buttons';

export type ButtonWidth = keyof typeof BUTTON_WIDTH;

export interface SuccessButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  throttleMs?: number;
  width?: ButtonWidth;
  disabled?: boolean;
  className?: string;
  id?: string;
  role?: string;
  'aria-label'?: string;
  'aria-disabled'?: boolean;
  title?: string;
  children?: React.ReactNode;
}

export const SuccessButton: React.FC<SuccessButtonProps> = ({
  onClick,
  throttleMs = BUTTON_THROTTLE_MS,
  width = 'max',
  disabled,
  className = '',
  id,
  role,
  'aria-label': ariaLabel,
  'aria-disabled': ariaDisabled,
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
      aria-disabled={ariaDisabled}
      title={title}
      className={`${BUTTON_MIN_HEIGHT} ${BUTTON_BASE} ${BUTTON_SUCCESS} ${BUTTON_WIDTH[width] ?? BUTTON_WIDTH.max} ${className}`.trim()}
    >
      {children}
    </button>
  );
};
