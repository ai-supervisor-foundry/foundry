import React from 'react';
import { useThrottledClick } from './useThrottledClick';
import {
  BUTTON_MIN_HEIGHT,
  BUTTON_BASE,
  BUTTON_PRIMARY,
  BUTTON_WIDTH,
  BUTTON_THROTTLE_MS,
} from '../../theme/buttons';

export type ButtonWidth = keyof typeof BUTTON_WIDTH;

export interface PrimaryButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  throttleMs?: number;
  width?: ButtonWidth;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  id?: string;
  role?: string;
  'aria-label'?: string;
  'aria-disabled'?: boolean;
  title?: string;
  children?: React.ReactNode;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  onClick,
  throttleMs = BUTTON_THROTTLE_MS,
  width = 'max',
  type = 'button',
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
      type={type}
      onClick={throttledOnClick}
      disabled={disabled}
      id={id}
      role={role}
      aria-label={ariaLabel}
      aria-disabled={ariaDisabled}
      title={title}
      className={`${BUTTON_MIN_HEIGHT} ${BUTTON_BASE} ${BUTTON_PRIMARY} ${BUTTON_WIDTH[width] ?? BUTTON_WIDTH.max} ${className}`.trim()}
    >
      {children}
    </button>
  );
};
