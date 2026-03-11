import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import {
  exceptionConstants,
  ExceptionObject,
  exceptionsList,
} from './exception.constants';
const exceptionHandlers = {
  [exceptionsList.ENOENT]: function (): ExceptionObject {
    return exceptionConstants[exceptionsList.ENOENT];
  },
  [exceptionsList.NOT_FOUND]: () => {
    return exceptionConstants[exceptionsList.NOT_FOUND];
  },
};

/**
 * Global Exception Filter
 * Catches all unhandled exceptions and provides centralized error handling
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Handle HTTP exceptions separately
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse as any).message || exception.message,
      };

      if (status >= 500) {
        this.logger.error(
          `${request.method} ${request.url} - ${status} - ${exception.message}`,
          exception.stack,
        );
      }

      return response.status(status).json(errorResponse);
    }

    // Handle custom exception handlers
    const useExceptionHandler =
      exceptionHandlers?.[exception?.message] ||
      exceptionHandlers?.[exception?.name] ||
      exceptionHandlers?.[exception?.code];

    const handler = useExceptionHandler
      ? (useExceptionHandler() as ExceptionObject)
      : null;

    if (!handler) {
      // Log unhandled exceptions
      this.logger.error(
        `Unhandled exception: ${exception?.message || 'Unknown error'}`,
        exception.stack,
        `${request.method} ${request.url}`,
      );

      const useStatus = exception?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      return response.status(useStatus).json({
        statusCode: useStatus,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message:
          process.env.NODE_ENV === 'production'
            ? 'An internal server error occurred'
            : exception.message,
      });
    }

    const { message, isHttp, statusCode } = handler;

    if (isHttp && statusCode === HttpStatus.CONFLICT) {
      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message,
      });
    }

    if (isHttp && statusCode === HttpStatus.NOT_FOUND) {
      return response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message,
      });
    }

    // Default error response
    this.logger.error(
      `Exception: ${message}`,
      exception.stack,
      `${request.method} ${request.url}`,
    );

    return response.status(500).json({
      statusCode: 500,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: exception.message || message,
    });
  }
}
