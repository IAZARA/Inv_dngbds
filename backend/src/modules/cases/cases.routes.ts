import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { requireAuth } from '../../middleware/require-auth';
import { requireRole } from '../../middleware/require-role';
import {
  createCaseHandler,
  deleteCaseDocumentHandler,
  deleteCaseHandler,
  deleteCasePhotoHandler,
  getCaseHandler,
  listCasesHandler,
  updateCaseDocumentDescriptionHandler,
  updateCaseHandler,
  updateCasePhotoDescriptionHandler,
  setPrimaryCasePhotoHandler,
  uploadCaseDocumentHandler,
  uploadCasePhotoHandler
} from './cases.controller';
import { caseDocumentUpload, casePhotoUpload } from '../../middleware/uploads';

const router = Router();

router.use(requireAuth);

router.get('/', listCasesHandler);
router.get('/:id', getCaseHandler);
router.post('/', requireRole(UserRole.ADMIN, UserRole.OPERATOR), createCaseHandler);
router.patch('/:id', requireRole(UserRole.ADMIN, UserRole.OPERATOR), updateCaseHandler);
router.delete('/:id', requireRole(UserRole.ADMIN, UserRole.OPERATOR), deleteCaseHandler);

router.post(
  '/:id/photos',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR),
  casePhotoUpload.single('file'),
  uploadCasePhotoHandler
);
router.patch(
  '/:caseId/photos/:photoId',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR),
  updateCasePhotoDescriptionHandler
);
router.patch(
  '/:caseId/photos/:photoId/primary',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR),
  setPrimaryCasePhotoHandler
);
router.delete(
  '/:caseId/photos/:photoId',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR),
  deleteCasePhotoHandler
);

router.post(
  '/:id/documents',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR),
  caseDocumentUpload.single('file'),
  uploadCaseDocumentHandler
);
router.patch(
  '/:caseId/documents/:documentId',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR),
  updateCaseDocumentDescriptionHandler
);
router.delete(
  '/:caseId/documents/:documentId',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR),
  deleteCaseDocumentHandler
);

export const casesRouter = router;
