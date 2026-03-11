import {
  SetMetadata,
  UseGuards,
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './role.guard';
import { AuthRequest } from './types/request.types';

export const ROLE_DECORATOR_KEY = 'roles';

/**
 * Require one of the given roles (from JWT). Admin passes all checks.
 * Returns 403 Forbidden if user role is not in the list.
 */
export const RequireRole = (...roles: string[]) =>
  SetMetadata(ROLE_DECORATOR_KEY, roles);

export function Auth(...allowedRoles: string[]) {
  return applyDecorators(
    SetMetadata(ROLE_DECORATOR_KEY, allowedRoles),
    UseGuards(AuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  );
}

/**
 * Parameter decorator to extract the authenticated user from the request.
 * Must be used with AuthGuard.
 *
 * @example
 * @Get()
 * @UseGuards(AuthGuard)
 * async getProfile(@User() user: AuthUser) {
 *   return user;
 * }
 */
export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthRequest>();
    return request.user;
  },
);
