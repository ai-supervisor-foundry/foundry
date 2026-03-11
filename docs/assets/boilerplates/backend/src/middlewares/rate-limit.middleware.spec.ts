import { RateLimitMiddleware } from './rate-limit.middleware';

describe('RateLimitMiddleware', () => {
  let middleware: RateLimitMiddleware;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    middleware = new RateLimitMiddleware();
    req = {};
    res = { setHeader: jest.fn() };
    next = jest.fn();
  });

  it('should set rate limit headers', () => {
    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Window', '60s');
  });

  it('should call next', () => {
    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
