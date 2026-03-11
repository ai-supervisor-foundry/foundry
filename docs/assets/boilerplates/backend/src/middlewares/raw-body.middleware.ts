import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.body && Buffer.isBuffer(req.body)) {
      (req as any).rawBody = req.body;
    }
    next();
  }
}
