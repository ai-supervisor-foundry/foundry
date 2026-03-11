import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TestModeMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (process.env.NODE_ENV === 'FORCE_INTERNAL_SERVER_ERROR') {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send('Internal Server Error');
    }

    if (process.env.NODE_ENV === 'FORCE_SERVICE_UNAVAILABLE') {
      return res
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .send('Service Unavailable');
    }

    if (process.env.NODE_ENV === 'FORCE_NOT_FOUND') {
      return res.status(HttpStatus.NOT_FOUND).send('Not Found');
    }

    if (process.env.NODE_ENV === 'FORCE_BAD_REQUEST') {
      return res.status(HttpStatus.BAD_REQUEST).send('Bad Request');
    }

    if (process.env.NODE_ENV === 'FORCE_UNAUTHORIZED') {
      return res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
    }

    if (process.env.NODE_ENV === 'FORCE_FORBIDDEN') {
      return res.status(HttpStatus.FORBIDDEN).send('Forbidden');
    }

    next();
  }
}
