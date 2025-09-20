import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from '../errors/AppError';

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('No autorizado', 401, true));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Acceso denegado', 403, true));
    }

    return next();
  };
};
