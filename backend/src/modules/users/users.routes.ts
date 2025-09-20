import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { requireAuth } from '../../middleware/require-auth';
import { requireRole } from '../../middleware/require-role';
import {
  createUserHandler,
  getCurrentUserHandler,
  listUsersHandler,
  resetPasswordHandler,
  updateUserHandler
} from './users.controller';

const router = Router();

router.get('/me', requireAuth, getCurrentUserHandler);

router.use(requireAuth, requireRole(UserRole.ADMIN));
router.get('/', listUsersHandler);
router.post('/', createUserHandler);
router.patch('/:id', updateUserHandler);
router.post('/:id/reset-password', resetPasswordHandler);

export const usersRouter = router;
