import { QueryExceptionFilter } from './query.exception';
import { ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

describe('QueryExceptionFilter', () => {
  let filter: QueryExceptionFilter;
  let mockResponse: Partial<Response>;
  let mockArgumentsHost: Partial<ArgumentsHost>;

  beforeEach(() => {
    filter = new QueryExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    it('should handle unknown query error', () => {
      const exception = {
        message: 'unknown database error',
        query: 'SELECT * FROM table',
        parameters: [],
      } as QueryFailedError;

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'some error occurred',
      });
    });

    it('should handle duplicate key constraint error', () => {
      const exception = {
        message: 'duplicate key value violates unique constraint',
        detail: 'Key (email)=(test@example.com) already exists',
        query: 'INSERT INTO users (email) VALUES ($1)',
        parameters: ['test@example.com'],
      } as unknown as QueryFailedError;

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 409,
        message: 'Key (email)=(test@example.com) already exists',
      });
    });
  });
});
