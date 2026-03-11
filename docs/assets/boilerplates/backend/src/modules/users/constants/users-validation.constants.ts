export const PasswordPattern =
  '^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@$!%*?&.])[A-Za-z0-9@$!%*?&.]{8,32}$';

/** Min 8 chars, 1 uppercase, 1 number */
export const PasswordStrengthPattern = '^(?=.*[A-Z])(?=.*[0-9]).{8,}$';
