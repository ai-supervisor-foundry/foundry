import { GlobalExceptionFilter } from './global.exception';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { exceptionConstants, exceptionsList } from './exception.constants';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: Partial<Response>;
  let mockArgumentsHost: Partial<ArgumentsHost>;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue({ url: '/test', method: 'GET' }),
      }),
    };
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    it('should handle ENOENT exception', () => {
      const exception = { message: exceptionsList.ENOENT };

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          message: exceptionConstants[exceptionsList.ENOENT].message,
          path: '/test',
          method: 'GET',
        }),
      );
    });

    it('should handle exception with custom status', () => {
      const exception = {
        message: 'Custom error',
        status: HttpStatus.BAD_REQUEST,
      };

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: exception.message,
          path: '/test',
          method: 'GET',
        }),
      );
    });

    it('should handle exception with code property', () => {
      const exception = {
        message: 'Some error',
        code: exceptionsList.ENOENT,
      };

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          message: exceptionConstants[exceptionsList.ENOENT].message,
          path: '/test',
          method: 'GET',
        }),
      );
    });

    it('should handle unknown exception with default status', () => {
      const exception = { message: 'Unknown error' };

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: exception.message,
          path: '/test',
          method: 'GET',
        }),
      );
    });

    it('should handle exception without message', () => {
      const exception = {};

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: undefined,
          path: '/test',
          method: 'GET',
        }),
      );
    });
  });
});
