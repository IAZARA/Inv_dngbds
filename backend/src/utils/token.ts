import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../config/env';

interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export const generateAccessToken = (payload: TokenPayload) => {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '30m' });
};
