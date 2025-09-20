import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request } from 'express';
import multer, { MulterError } from 'multer';

const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const getCaseIdFromRequest = (req: Request) => {
  const caseId = (req.params?.id ?? req.params?.caseId) as string | undefined;
  return caseId;
};

const resolveDestination = (caseId: string, subfolder: string) => {
  const dir = path.join(UPLOAD_ROOT, 'cases', caseId, subfolder);
  ensureDir(dir);
  return dir;
};

const filenameFactory = (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const extension = path.extname(file.originalname);
  cb(null, `${unique}${extension}`);
};

const buildStorage = (subfolder: 'photos' | 'documents'): multer.StorageEngine =>
  multer.diskStorage({
    destination: (req, _file, cb) => {
      const caseId = getCaseIdFromRequest(req);
      if (!caseId) {
        return cb(new MulterError('LIMIT_UNEXPECTED_FILE', 'missing_case_id'), '');
      }
      try {
        const dir = resolveDestination(caseId, subfolder);
        cb(null, dir);
      } catch (error) {
        cb(error as Error, '');
      }
    },
    filename: filenameFactory
  });

const photoFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
  }
};

const allowedDocumentMime = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet'
]);

const documentFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
    return;
  }
  if (allowedDocumentMime.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
};

export const casePhotoUpload = multer({
  storage: buildStorage('photos'),
  fileFilter: photoFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

export const caseDocumentUpload = multer({
  storage: buildStorage('documents'),
  fileFilter: documentFilter,
  limits: { fileSize: 15 * 1024 * 1024 }
});

export const uploadsStaticPath = UPLOAD_ROOT;
