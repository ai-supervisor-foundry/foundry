import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthIndicatorResult,
  HealthCheckService,
} from '@nestjs/terminus';
import { Public } from '../auth/auth.guard';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthCheckService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Simple health check endpoint' })
  @ApiResponse({ status: 200, description: 'API is healthy' })
  async simpleCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('liveness')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness health check with detailed status' })
  @ApiResponse({ status: 200, description: 'API liveness check passed' })
  async check(): Promise<HealthCheckResult> {
    return this.healthService.check([
      async (): Promise<HealthIndicatorResult> => ({
        api: { status: 'up' },
      }),
    ]);
  }
}
