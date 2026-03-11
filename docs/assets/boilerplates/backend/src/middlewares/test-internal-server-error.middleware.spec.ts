import { TestModeMiddleware } from './test-internal-server-error.middleware';
import { Request, Response, NextFunction } from 'express';
import { HttpStatus } from '@nestjs/common';

describe('TestModeMiddleware', () => {
  let middleware: TestModeMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new TestModeMiddleware();
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    it('should return internal server error when NODE_ENV is FORCE_INTERNAL_SERVER_ERROR', () => {
      process.env.NODE_ENV = 'FORCE_INTERNAL_SERVER_ERROR';

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.send).toHaveBeenCalledWith('Internal Server Error');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return service unavailable when NODE_ENV is FORCE_SERVICE_UNAVAILABLE', () => {
      process.env.NODE_ENV = 'FORCE_SERVICE_UNAVAILABLE';

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      expect(mockResponse.send).toHaveBeenCalledWith('Service Unavailable');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return not found when NODE_ENV is FORCE_NOT_FOUND', () => {
      process.env.NODE_ENV = 'FORCE_NOT_FOUND';

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.send).toHaveBeenCalledWith('Not Found');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return bad request when NODE_ENV is FORCE_BAD_REQUEST', () => {
      process.env.NODE_ENV = 'FORCE_BAD_REQUEST';

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.send).toHaveBeenCalledWith('Bad Request');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return unauthorized when NODE_ENV is FORCE_UNAUTHORIZED', () => {
      process.env.NODE_ENV = 'FORCE_UNAUTHORIZED';

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.send).toHaveBeenCalledWith('Unauthorized');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return forbidden when NODE_ENV is FORCE_FORBIDDEN', () => {
      process.env.NODE_ENV = 'FORCE_FORBIDDEN';

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.send).toHaveBeenCalledWith('Forbidden');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() when NODE_ENV is not a test mode', () => {
      process.env.NODE_ENV = 'development';

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.send).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.send).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.send).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
