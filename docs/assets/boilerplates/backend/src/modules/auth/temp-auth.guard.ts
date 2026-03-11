import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthRequest } from './types/request.types';
import { Reflector } from '@nestjs/core';
import { TEMP_TOKEN_TYPE } from './temp-auth.decorator';

@Injectable()
export class TempAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token =
      this.extractTokenFromQuery(request) ??
      this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    const expectedType = this.reflector.getAllAndOverride<string>(
      TEMP_TOKEN_TYPE,
      [context.getHandler(), context.getClass()],
    );
    if (!expectedType) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (payload.type != expectedType) {
        throw new UnauthorizedException();
      }
    } catch (exc) {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: AuthRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    request.token = token;
    return type?.toLowerCase() === 'bearer' ? token : null;
  }
  private extractTokenFromQuery(request: AuthRequest): string | undefined {
    return request.query.token as string;
  }
}
