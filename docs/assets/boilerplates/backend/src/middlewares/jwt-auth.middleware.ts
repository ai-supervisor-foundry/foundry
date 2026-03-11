import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EnvProps } from '../env';

export interface AuthenticatedRequest extends Request {
  user?: any;
  token?: string;
}

/**
 * JWT Authentication Middleware
 * Validates JWT tokens from Authorization header and attaches user to request
 * Can be used globally or selectively on routes
 */
@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvProps, true>,
  ) {}

  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    // Skip authentication for public routes (handled by guards)
    // This middleware is for routes that explicitly need authentication
    const token = this.extractTokenFromHeader(req);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      // Attach user info to request
      req.user = payload;
      req.token = token;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }
      throw new UnauthorizedException(error.message || 'Authentication failed');
    }

    next();
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type?.toLowerCase() === 'bearer' ? token : undefined;
  }
}
