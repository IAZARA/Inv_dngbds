import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { AppError } from '../errors/AppError';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('No autorizado', 401, true));
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.isActive) {
      return next(new AppError('Cuenta inactiva o inexistente', 401, true));
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    return next();
  } catch (error) {
    return next(new AppError('Token inválido', 401, true));
  }
};
