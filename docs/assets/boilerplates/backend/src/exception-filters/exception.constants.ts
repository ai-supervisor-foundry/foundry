import { HttpStatus } from '@nestjs/common';

export type ExceptionObject = {
  message: string;
  isHttp?: boolean;
  statusCode?: HttpStatus;
};

export type ExceptionObjectMap = {
  [key: string]: ExceptionObject;
};

export enum exceptionsList {
  ENOENT = 'ENOENT',
  NOT_FOUND = 'NotFoundException',
}

export const exceptionConstants: ExceptionObjectMap = {
  [exceptionsList.ENOENT]: {
    message: 'File not found',
    statusCode: HttpStatus.NOT_FOUND,
    isHttp: true,
  },
  [exceptionsList.NOT_FOUND]: {
    message: 'Howdy, you seem lost. Resources not found',
    statusCode: HttpStatus.NOT_FOUND,
    isHttp: true,
  },
};
