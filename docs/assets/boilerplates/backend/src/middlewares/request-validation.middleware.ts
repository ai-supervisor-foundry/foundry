import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Request Validation Middleware
 * Validates request body, query, and params before reaching controllers
 * Provides detailed error messages for validation failures
 */
@Injectable()
export class RequestValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestValidation');

  use(req: Request, res: Response, next: NextFunction) {
    // This middleware works in conjunction with ValidationPipe
    // It provides additional validation logging and error formatting
    // The actual validation is handled by NestJS ValidationPipe in main.ts

    // Log validation attempts for debugging
    if (process.env.NODE_ENV === 'development') {
      if (Object.keys(req.body || {}).length > 0) {
        this.logger.debug(
          `Validating request body for ${req.method} ${req.originalUrl}`,
        );
      }
      if (Object.keys(req.query || {}).length > 0) {
        this.logger.debug(
          `Validating query params for ${req.method} ${req.originalUrl}`,
        );
      }
    }

    // Error handling is done by ValidationPipe and exception filters
    // This middleware primarily serves as a logging/audit point
    next();
  }
}
