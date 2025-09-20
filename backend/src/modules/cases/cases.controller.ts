import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../errors/AppError';
import {
  createCase,
  deleteCase,
  getCaseById,
  listCases,
  updateCase
} from './cases.service';
import { createCaseSchema, updateCaseSchema } from './cases.schemas';

export const listCasesHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cases = await listCases();
    res.json({ cases });
  } catch (error) {
    next(error);
  }
};

export const getCaseHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const caseData = await getCaseById(req.params.id);
    res.json({ case: caseData });
  } catch (error) {
    next(error);
  }
};

export const createCaseHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createCaseSchema.parse(req.body);
    const created = await createCase(payload);
    res.status(201).json({ case: created });
  } catch (error) {
    next(error);
  }
};

export const updateCaseHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = updateCaseSchema.parse(req.body);
    const hasCaseFields = ['numeroCausa', 'fechaHecho', 'estadoSituacion', 'fuerzaAsignada', 'reward'].some(
      (key) => payload[key as keyof typeof payload] !== undefined
    );
    const hasPersonFields = payload.persona ? Object.keys(payload.persona).length > 0 : false;

    if (!hasCaseFields && !hasPersonFields) {
      throw new AppError('No hay cambios para aplicar', 400, true);
    }
    const updated = await updateCase(req.params.id, payload);
    res.json({ case: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteCaseHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteCase(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
