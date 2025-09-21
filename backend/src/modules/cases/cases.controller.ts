import { NextFunction, Request, Response } from 'express';
import fs from 'node:fs/promises';
import type { Express } from 'express';
import { CaseMediaKind } from '@prisma/client';
import { AppError } from '../../errors/AppError';
import {
  addCaseDocument,
  addCasePhoto,
  createCase,
  deleteCase,
  generateCasePdf,
  generateCaseZip,
  exportCasesToExcel,
  getCaseById,
  listCases,
  removeCaseMedia,
  setCasePrimaryPhoto,
  updateCase,
  updateCaseMediaDescription
} from './cases.service';
import { createCaseSchema, mediaDescriptionSchema, updateCaseSchema } from './cases.schemas';

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

export const exportCasePdfHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { buffer, fileName } = await generateCasePdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const exportCaseZipHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { buffer, fileName } = await generateCaseZip(req.params.id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const exportCasesExcelHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : [];
    if (ids.length === 0) {
      throw new AppError('Debe seleccionar al menos un caso para exportar', 400, true);
    }
    const buffer = await exportCasesToExcel(ids);
    const filename = `casos_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
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
    const caseFieldKeys = [
      'numeroCausa',
      'caratula',
      'juzgadoInterventor',
      'secretaria',
      'fiscalia',
      'jurisdiccion',
      'delito',
      'fechaHecho',
      'estadoRequerimiento',
      'fuerzaAsignada',
      'recompensa',
      'rewardAmount'
    ] as const;

    const hasCaseFields = caseFieldKeys.some((key) => payload[key] !== undefined);
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

const cleanupUploadedFile = async (file?: Express.Multer.File | null) => {
  if (!file?.path) return;
  try {
    await fs.unlink(file.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
};

export const uploadCasePhotoHandler = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    next(new AppError('Archivo requerido', 400, true));
    return;
  }

  try {
    const description = typeof req.body?.description === 'string' ? req.body.description : undefined;
    const photo = await addCasePhoto(req.params.id, req.file, description);
    res.status(201).json({ photo });
  } catch (error) {
    await cleanupUploadedFile(req.file).catch(() => undefined);
    next(error);
  }
};

export const uploadCaseDocumentHandler = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    next(new AppError('Archivo requerido', 400, true));
    return;
  }

  try {
    const description = typeof req.body?.description === 'string' ? req.body.description : undefined;
    const document = await addCaseDocument(req.params.id, req.file, description);
    res.status(201).json({ document });
  } catch (error) {
    await cleanupUploadedFile(req.file).catch(() => undefined);
    next(error);
  }
};

export const updateCasePhotoDescriptionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { description } = mediaDescriptionSchema.parse(req.body);
    const updated = await updateCaseMediaDescription(
      req.params.caseId,
      req.params.photoId,
      description,
      CaseMediaKind.PHOTO
    );
    res.json({ photo: updated });
  } catch (error) {
    next(error);
  }
};

export const setPrimaryCasePhotoHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photo = await setCasePrimaryPhoto(req.params.caseId, req.params.photoId);
    res.json({ photo });
  } catch (error) {
    next(error);
  }
};

export const updateCaseDocumentDescriptionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { description } = mediaDescriptionSchema.parse(req.body);
    const updated = await updateCaseMediaDescription(
      req.params.caseId,
      req.params.documentId,
      description,
      CaseMediaKind.DOCUMENT
    );
    res.json({ document: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteCasePhotoHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await removeCaseMedia(req.params.caseId, req.params.photoId, CaseMediaKind.PHOTO);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const deleteCaseDocumentHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await removeCaseMedia(req.params.caseId, req.params.documentId, CaseMediaKind.DOCUMENT);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
