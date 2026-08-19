import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  role: string;
}

export interface AuthUser {
  userId: string;
  username: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
