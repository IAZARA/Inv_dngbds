import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { requireAuth } from '../../middleware/require-auth';
import { requireRole } from '../../middleware/require-role';
import {
  createCaseHandler,
  deleteCaseHandler,
  getCaseHandler,
  listCasesHandler,
  updateCaseHandler
} from './cases.controller';

const router = Router();

router.use(requireAuth);

router.get('/', listCasesHandler);
router.get('/:id', getCaseHandler);
router.post('/', requireRole(UserRole.ADMIN, UserRole.OPERATOR), createCaseHandler);
router.patch('/:id', requireRole(UserRole.ADMIN, UserRole.OPERATOR), updateCaseHandler);
router.delete('/:id', requireRole(UserRole.ADMIN, UserRole.OPERATOR), deleteCaseHandler);

export const casesRouter = router;
