import { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../errors/AppError';
import { createUser, deleteUser, listUsers, resetPassword, updateUser } from './users.service';
import { createUserSchema, resetPasswordSchema, updateUserSchema } from './users.schemas';

export const listUsersHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (error) {
    next(error);
  }
};

export const createUserHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createUserSchema.parse(req.body);
    const user = await createUser(payload);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

export const updateUserHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = updateUserSchema.parse(req.body);
    const user = await updateUser(req.params.id, payload);
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const resetPasswordHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = resetPasswordSchema.parse(req.body);
    await resetPassword(req.params.id, payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const deleteUserHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('No autorizado', 401, true);
    }
    await deleteUser(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getCurrentUserHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('No autorizado', 401, true);
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new AppError('Usuario no encontrado', 404, true);
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
};
