import { Request } from 'express';
import { User } from '../../users/entities/user.entity';

export interface AuthRequest extends Request {
  user: User;
  user_id: number;
  token: string;
  headers: Request['headers'];
  query: Request['query'];
}
