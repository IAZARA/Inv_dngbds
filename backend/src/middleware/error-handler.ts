import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Datos inválidos',
      details: err.flatten()
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.expose ? err.message : 'Error',
      message: err.expose ? err.message : 'Ocurrió un error'
    });
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el tamaño permitido'
        : 'El tipo de archivo no es válido';
    return res.status(400).json({ error: 'UploadError', message });
  }

  console.error(err);
  return res.status(500).json({ error: 'InternalServerError', message: 'Ocurrió un error inesperado' });
};
