/**
 * Mock objects for boilerplate functional tests.
 * User-only. Add domain mocks when extending.
 */
import type { User } from '../../types';
import { UserRole } from '../../types';

export const MOCK_USER: User = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  role: UserRole.USER,
};

export const MOCK_ADMIN: User = {
  id: '2',
  name: 'Admin User',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
};

export const MOCK_MANAGER: User = {
  id: '5',
  name: 'Manager User',
  email: 'mgr@example.com',
  role: UserRole.MANAGER,
};

export const MOCK_SUBORDINATE: User = {
  id: '3',
  name: 'Subordinate User',
  email: 'sub@example.com',
  role: UserRole.USER,
  managerId: 5,
};
