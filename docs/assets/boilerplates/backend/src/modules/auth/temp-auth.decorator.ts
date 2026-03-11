import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { TempAuthGuard } from './temp-auth.guard';

export const TEMP_TOKEN_TYPE = 'tempTokenType';
export function TempAuth(type: string) {
  return applyDecorators(
    SetMetadata(TEMP_TOKEN_TYPE, type),
    UseGuards(TempAuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  );
}
