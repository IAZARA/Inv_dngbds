import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { requireAuth } from '../../middleware/require-auth';
import { requireRole } from '../../middleware/require-role';
import {
  addSourceRecordHandler,
  createPersonHandler,
  getPersonHandler,
  listPersonsHandler,
  updatePersonHandler
} from './persons.controller';

const router = Router();

router.use(requireAuth);

router.get('/', listPersonsHandler);
router.get('/:id', getPersonHandler);
router.post('/', requireRole(UserRole.ADMIN, UserRole.OPERATOR), createPersonHandler);
router.patch('/:id', requireRole(UserRole.ADMIN, UserRole.OPERATOR), updatePersonHandler);
router.post(
  '/:id/sources',
  requireRole(UserRole.ADMIN, UserRole.OPERATOR),
  addSourceRecordHandler
);

export const personsRouter = router;
