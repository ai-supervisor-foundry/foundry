import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_DECORATOR_KEY } from './auth.decorator';
import { AuthRequest } from './types/request.types';

/**
 * Role-Based Access Control Guard
 * Validates user roles against required roles for protected routes
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger('RolesGuard');

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedRoles = this.reflector.getAllAndOverride<string[]>(
      ROLE_DECORATOR_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are specified, allow access (route is not role-protected)
    if (!expectedRoles || expectedRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();

    // Check if user is authenticated
    if (!request.user) {
      this.logger.warn(
        `Unauthorized access attempt to ${context.getHandler().name}`,
      );
      throw new ForbiddenException('User not authenticated');
    }

    // Get user role (handle both old and new auth systems)
    const userRole =
      request.user?.role?.toLowerCase() ||
      (request.user as any)?.role?.toLowerCase();

    if (!userRole) {
      this.logger.warn(
        `User ${request.user?.id || 'unknown'} has no role assigned`,
      );
      throw new ForbiddenException('User role not found');
    }

    // Admin can do everything
    if (userRole === 'admin') {
      return true;
    }

    // Check if user role matches any of the expected roles
    const hasAccess = expectedRoles.some(
      (role) => role.toLowerCase() === userRole,
    );

    if (!hasAccess) {
      this.logger.warn(
        `Access denied for user ${request.user?.id || 'unknown'} with role ${userRole}. Required roles: ${expectedRoles.join(', ')}`,
      );
      throw new ForbiddenException(
        `Access denied. Required roles: ${expectedRoles.join(', ')}`,
      );
    }

    return true;
  }
}
