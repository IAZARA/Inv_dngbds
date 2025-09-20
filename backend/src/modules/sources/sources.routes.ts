import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { requireAuth } from '../../middleware/require-auth';
import { requireRole } from '../../middleware/require-role';
import { createSourceHandler, listSourcesHandler, updateSourceHandler } from './sources.controller';

const router = Router();

router.use(requireAuth);

router.get('/', listSourcesHandler);
router.post('/', requireRole(UserRole.ADMIN, UserRole.OPERATOR), createSourceHandler);
router.patch('/:id', requireRole(UserRole.ADMIN, UserRole.OPERATOR), updateSourceHandler);

export const sourcesRouter = router;
