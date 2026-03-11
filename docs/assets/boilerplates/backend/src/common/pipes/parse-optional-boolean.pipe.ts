import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * Pipe to parse optional boolean values from query parameters
 */
@Injectable()
export class ParseOptionalBooleanPipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata): boolean | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'true' || value === '1') {
      return true;
    }

    if (value === 'false' || value === '0') {
      return false;
    }

    return undefined;
  }
}
