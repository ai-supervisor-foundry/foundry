import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * Pipe to parse optional integer values from query parameters
 */
@Injectable()
export class ParseOptionalIntPipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const val = parseInt(value as string, 10);
    if (isNaN(val)) {
      return undefined;
    }

    return val;
  }
}
