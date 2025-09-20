import { Request, Response, NextFunction } from 'express';
import { changePassword, login } from './auth.service';
import { changePasswordSchema, loginSchema } from './auth.schemas';

export const loginHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await login(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const changePasswordHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const payload = changePasswordSchema.parse(req.body);
    await changePassword(req.user.id, payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
