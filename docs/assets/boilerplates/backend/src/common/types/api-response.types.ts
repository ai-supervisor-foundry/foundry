import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiSuccessResponse<T = unknown> {
  @ApiProperty({ default: true })
  success: true;

  @ApiPropertyOptional()
  data?: T;

  @ApiPropertyOptional()
  message?: string;
}

export class ApiErrorResponse {
  @ApiProperty({ default: false })
  success: false;

  @ApiProperty()
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };

  @ApiPropertyOptional()
  timestamp?: string;

  @ApiPropertyOptional()
  path?: string;
}

export function successResponse<T>(
  data?: T,
  message?: string,
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };
}
