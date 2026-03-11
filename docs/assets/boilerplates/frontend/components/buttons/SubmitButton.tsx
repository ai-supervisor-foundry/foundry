import React from 'react';
import { PrimaryButton } from './PrimaryButton';

import { BUTTON_THROTTLE_MS } from '../../theme/buttons';

export interface SubmitButtonProps {
  throttleMs?: number;
  width?: 'auto' | 'cta' | 'full' | 'max' | 'flex';
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  children?: React.ReactNode;
}

/**
 * Primary-styled submit button for forms. Uses form's onSubmit; throttleMs
 * throttles rapid clicks to prevent double-submit.
 */
export const SubmitButton: React.FC<SubmitButtonProps> = ({
  throttleMs = BUTTON_THROTTLE_MS,
  width = 'full',
  disabled,
  className,
  id,
  'aria-label': ariaLabel,
  children,
}) => (
  <PrimaryButton
    type="submit"
    throttleMs={throttleMs}
    width={width}
    disabled={disabled}
    className={className}
    id={id}
    aria-label={ariaLabel}
  >
    {children}
  </PrimaryButton>
);
