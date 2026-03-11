import { Injectable } from '@nestjs/common';
import { hash, compare } from 'bcrypt';

export interface PasswordStrengthResult {
  valid: boolean;
  errors: string[];
}

const MIN_LENGTH = 8;
const UPPERCASE_REGEX = /[A-Z]/;
const NUMBER_REGEX = /\d/;
const SPECIAL_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

@Injectable()
export class PasswordService {
  async hashPassword(plaintext: string): Promise<string> {
    const saltRounds = 10;
    return hash(plaintext, saltRounds);
  }

  async verifyPassword(plaintext: string, hashStr: string): Promise<boolean> {
    if (!plaintext || !hashStr) return false;
    return compare(plaintext, hashStr);
  }

  /**
   * Validates password strength (recommended: min 8, 1 uppercase, 1 number, 1 special char).
   */
  validatePasswordStrength(plaintext: string): PasswordStrengthResult {
    const errors: string[] = [];
    if (plaintext.length < MIN_LENGTH) {
      errors.push(`Password must be at least ${MIN_LENGTH} characters`);
    }
    if (!UPPERCASE_REGEX.test(plaintext)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!NUMBER_REGEX.test(plaintext)) {
      errors.push('Password must contain at least one number');
    }
    if (!SPECIAL_REGEX.test(plaintext)) {
      errors.push('Password must contain at least one special character');
    }
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
