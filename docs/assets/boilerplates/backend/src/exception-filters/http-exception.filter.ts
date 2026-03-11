import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

/**
 * HTTP Exception Filter
 * Handles all HTTP exceptions with proper error formatting and logging
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Format error response
    const errorResponse: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message,
      ...(typeof exceptionResponse === 'object' &&
        !(exceptionResponse as any).message && { ...exceptionResponse }),
    };

    // Extract retryAfter from exception response if it's an object
    if (
      typeof exceptionResponse === 'object' &&
      (exceptionResponse as any).retryAfter !== undefined
    ) {
      errorResponse.retryAfter = (exceptionResponse as any).retryAfter;
    }

    // Validate and sanitize retryAfter for rate limit errors (429)
    if (status === 429 || (errorResponse as any).retryAfter !== undefined) {
      const retryAfter = (errorResponse as any).retryAfter;
      if (retryAfter !== undefined) {
        // Validate retryAfter is a positive number and reasonable (max 1 hour)
        if (
          typeof retryAfter === 'number' &&
          !isNaN(retryAfter) &&
          isFinite(retryAfter) &&
          retryAfter > 0 &&
          retryAfter <= 3600
        ) {
          errorResponse.retryAfter = Math.round(retryAfter);
        } else {
          // Remove invalid retryAfter value
          delete errorResponse.retryAfter;
          // Update message if it contains invalid retryAfter
          if (
            typeof errorResponse.message === 'string' &&
            errorResponse.message.includes('seconds')
          ) {
            const negativeMatch = errorResponse.message.match(
              /try again in (-?\d+) seconds/i,
            );
            if (negativeMatch && parseInt(negativeMatch[1], 10) < 0) {
              errorResponse.message =
                'Too many requests. Please try again later.';
            }
          }
        }
      }
    }

    // Log error
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${exception.message}`,
        exception.stack,
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} - ${status} - ${exception.message}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
