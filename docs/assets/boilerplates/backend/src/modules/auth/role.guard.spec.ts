import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './role.guard';
import { AuthRequest } from './types/request.types';
import { UserRole } from '../users/entities/user.entity';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const mockContext = (request: Partial<AuthRequest>, handlerName = 'test') =>
    ({
      getHandler: () => ({ name: handlerName }),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new RolesGuard(reflector);
  });

  it('should allow when no roles specified', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = mockContext({ user: { id: 1, role: UserRole.USER } as any });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow admin for any role', () => {
    reflector.getAllAndOverride.mockReturnValue(['manager']);
    const ctx = mockContext({ user: { id: 1, role: UserRole.ADMIN } as any });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow when user role matches', () => {
    reflector.getAllAndOverride.mockReturnValue(['user', 'manager']);
    const ctx = mockContext({ user: { id: 1, role: UserRole.USER } as any });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw when user not authenticated', () => {
    reflector.getAllAndOverride.mockReturnValue(['user']);
    const ctx = mockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw when user role does not match', () => {
    reflector.getAllAndOverride.mockReturnValue(['manager']);
    const ctx = mockContext({ user: { id: 1, role: UserRole.USER } as any });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
