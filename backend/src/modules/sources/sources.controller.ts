import { NextFunction, Request, Response } from 'express';
import { createSource, listSources, updateSource } from './sources.service';
import { createSourceSchema, updateSourceSchema } from './sources.schemas';

export const listSourcesHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sources = await listSources();
    res.json({ sources });
  } catch (error) {
    next(error);
  }
};

export const createSourceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createSourceSchema.parse(req.body);
    const source = await createSource(payload);
    res.status(201).json({ source });
  } catch (error) {
    next(error);
  }
};

export const updateSourceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = updateSourceSchema.parse(req.body);
    const source = await updateSource(req.params.id, payload);
    res.json({ source });
  } catch (error) {
    next(error);
  }
};
