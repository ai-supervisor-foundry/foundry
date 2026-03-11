import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { AuthRequest } from './types/request.types';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let reflector: jest.Mocked<Reflector>;

  const mockContext = (request: Partial<AuthRequest>) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    } as any;
    configService = { get: jest.fn().mockReturnValue('secret') } as any;
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as any;
    guard = new AuthGuard(jwtService, configService, reflector);
  });

  it('should allow when isPublic is true', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const req = {};
    const ctx = mockContext(req);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should allow when request.user already set', async () => {
    const req = { user: { id: 1, role: 'user' } } as any;
    const ctx = mockContext(req);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should throw when no token in header', async () => {
    const req = { headers: {} };
    const ctx = mockContext(req);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should verify token and set user when Bearer token present', async () => {
    const req = { headers: { authorization: 'Bearer token123' } } as any;
    const ctx = mockContext(req);
    jwtService.verifyAsync.mockResolvedValue({
      sub: 1,
      email: 'a@b.com',
      role: 'user',
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req).toMatchObject({ user: { id: 1, role: 'user' } });
  });
});
