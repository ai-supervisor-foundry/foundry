import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { TempAuthGuard } from './temp-auth.guard';

describe('TempAuthGuard', () => {
  let guard: TempAuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let reflector: jest.Mocked<Reflector>;

  const mockContext = (request: any) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() } as any;
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('reset-password'),
    } as any;
    guard = new TempAuthGuard(reflector, jwtService);
  });

  it('should throw when no token', async () => {
    const ctx = mockContext({ headers: {}, query: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow when valid token from header', async () => {
    jwtService.verifyAsync.mockResolvedValue({ type: 'reset-password' });
    const ctx = mockContext({
      headers: { authorization: 'Bearer token123' },
      query: {},
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('should allow when valid token from query', async () => {
    jwtService.verifyAsync.mockResolvedValue({ type: 'reset-password' });
    const ctx = mockContext({ headers: {}, query: { token: 'token123' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
