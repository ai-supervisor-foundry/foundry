import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Rate Limiting Middleware
 *
 * Note: Rate limiting is primarily handled by ThrottlerGuard and @Throttle decorators.
 * This middleware serves as a helper to set rate limit headers and can be used
 * in conjunction with the throttler system.
 *
 * For actual rate limiting, use:
 * - @Throttle() decorator on controllers/routes
 * - ThrottlerGuard (already configured globally)
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Set rate limit headers for client information
    // Actual rate limiting is handled by ThrottlerGuard
    // These headers provide information about rate limits
    res.setHeader('X-RateLimit-Limit', '100');
    res.setHeader('X-RateLimit-Window', '60s');

    // The actual rate limiting is enforced by ThrottlerGuard
    // which is configured globally in AuthModule
    next();
  }
}
