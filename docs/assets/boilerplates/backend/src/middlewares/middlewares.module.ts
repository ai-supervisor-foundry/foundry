import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthMiddleware } from './jwt-auth.middleware';
import { LoggingMiddleware } from './logging.middleware';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { RequestValidationMiddleware } from './request-validation.middleware';

/**
 * Middlewares Module
 * Configures and exports all application middleware
 */
@Module({
  imports: [JwtModule, ConfigModule],
  providers: [
    JwtAuthMiddleware,
    LoggingMiddleware,
    RateLimitMiddleware,
    RequestValidationMiddleware,
  ],
  exports: [
    JwtAuthMiddleware,
    LoggingMiddleware,
    RateLimitMiddleware,
    RequestValidationMiddleware,
  ],
})
export class MiddlewaresModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply logging middleware to all routes
    consumer.apply(LoggingMiddleware).forRoutes('*');

    // JWT Auth middleware can be applied selectively via guards
    // Guards are preferred for authentication in NestJS
    // This middleware is available for cases where middleware is needed

    // Rate limiting and validation middleware are available
    // but typically handled by guards and ValidationPipe
  }
}
