import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../errors/AppError';
import { addSourceRecord, createPerson, getPersonById, listPersons, updatePerson } from './persons.service';
import { createPersonSchema, createSourceRecordSchema, updatePersonSchema } from './persons.schemas';

export const listPersonsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const persons = await listPersons();
    res.json({ persons });
  } catch (error) {
    next(error);
  }
};

export const createPersonHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createPersonSchema.parse(req.body);
    const person = await createPerson(payload);
    res.status(201).json({ person });
  } catch (error) {
    next(error);
  }
};

export const getPersonHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const person = await getPersonById(req.params.id);
    res.json({ person });
  } catch (error) {
    next(error);
  }
};

export const updatePersonHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = updatePersonSchema.parse(req.body);
    const person = await updatePerson(req.params.id, payload);
    res.json({ person });
  } catch (error) {
    next(error);
  }
};

export const addSourceRecordHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('No autorizado', 401, true);
    }
    const payload = createSourceRecordSchema.parse(req.body);
    const record = await addSourceRecord(req.params.id, req.user.id, payload);
    res.status(201).json({ record });
  } catch (error) {
    next(error);
  }
};
