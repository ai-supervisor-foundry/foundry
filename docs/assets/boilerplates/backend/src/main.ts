import { types } from 'pg';
types.setTypeParser(1082, (val: string) => val);

import {
  BadRequestException,
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';
import { QueryExceptionFilter } from './exception-filters/query.exception';
import { TestModeMiddleware } from './middlewares/test-internal-server-error.middleware';
import { promises as fsPromises } from 'fs';
import { GlobalExceptionFilter } from './exception-filters/global.exception';
import { HttpExceptionFilter } from './exception-filters/http-exception.filter';
import { LoggingMiddleware } from './middlewares/logging.middleware';

async function bootstrap() {
  const directoriesToBootstrap = ['dist/temp-fs/assets/html'];
  for await (const directory of directoriesToBootstrap) {
    try {
      await fsPromises.mkdir(directory, { recursive: true });
    } catch (error) {
      console.error(error);
    }
  }

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.use(json({ limit: '100mb' }));

  // Request Validation Configuration
  // Enhanced validation with detailed error messages
  const logger = new Logger('ValidationPipe');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transformOptions: {
        enableImplicitConversion: true, // Automatically transform primitive types
      },
      exceptionFactory: (errors) => {
        const messages = errors
          .map((error) => {
            const constraints = error.constraints || {};
            return Object.values(constraints).join(', ');
          })
          .filter(Boolean);

        // Enhanced error logging
        logger.error('Validation failed:', {
          errors: errors.map((error) => ({
            property: error.property,
            constraints: error.constraints,
            value: error.value,
            target: error.target?.constructor?.name,
          })),
          messages,
        });

        // Return detailed validation error
        return new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          errors: messages,
          details: errors.map((error) => ({
            property: error.property,
            constraints: error.constraints,
          })),
        });
      },
    }),
  );
  // Global Interceptors
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Global Exception Filters (order matters - more specific first)
  app.useGlobalFilters(new QueryExceptionFilter());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global Middleware
  // Logging middleware should be first to log all requests
  // Note: LoggingMiddleware doesn't require DI, so we can use it directly
  const loggingMiddleware = new LoggingMiddleware();
  app.use(loggingMiddleware.use.bind(loggingMiddleware));
  app.use(new TestModeMiddleware().use);

  app.enableShutdownHooks();

  // CORS Configuration
  // Configure CORS for frontend origin with proper security settings
  const corsAllowedOrigins =
    process.env.CORS_ORIGINS?.split(',').filter(Boolean);

  if (corsAllowedOrigins?.length) {
    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is in allowed list
        if (corsAllowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ],
      preflightContinue: false,
      optionsSuccessStatus: 204,
      maxAge: 86400, // 24 hours
    });
  } else {
    // Fallback: allow all origins in development (not recommended for production)
    if (process.env.NODE_ENV === 'development') {
      app.enableCors({
        origin: true,
        credentials: true,
      });
    }
  }

  const port = process.env.APP_PORT || 3000;

  // Retry logic for port binding
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await app.listen(port, '0.0.0.0');
      console.log(`Application is running on: http://0.0.0.0:${port}`);
      break;
    } catch (error) {
      if (error.code === 'EADDRINUSE' && i < maxRetries - 1) {
        const delay = 500 * Math.pow(2, i);
        console.log(
          `Port ${port} in use, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, closing application gracefully...`);
    try {
      await app.close();
      console.log('Application closed successfully');
      process.exit(0);
    } catch (error) {
      // Ignore TypeORM "Called end on pool more than once" error during watch mode restarts
      if (
        error?.message?.includes('Called end on pool more than once') ||
        error?.message?.includes('pool is draining')
      ) {
        console.log('Application closed (pool already closed)');
        process.exit(0);
      }
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('beforeExit', () => {
    console.log('Process beforeExit event');
  });
}
bootstrap();
